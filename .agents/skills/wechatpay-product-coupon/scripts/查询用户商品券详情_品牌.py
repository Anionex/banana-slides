#!/usr/bin/env python3
"""
品牌直连 - 查询用户商品券详情
API文档：https://pay.weixin.qq.com/doc/brand/4015736414

依赖：Python3（macOS/Linux 自带）
无需 pip install 任何第三方库。

所有参数通过命令行传入，脚本内不硬编码任何配置。
模型负责交互式收集参数，拼装命令行调用本脚本。

签名模式：用户在自己的服务器上完成签名后，将签名值（Base64）、时间戳、随机串传入，
脚本直接使用这些值构造 Authorization 头并发送请求。

用法：
  python3 查询用户商品券详情_品牌.py \
    --brand-id <品牌ID> \
    --serial-no <API证书序列号> \
    --signature <Base64签名值> \
    --timestamp <签名时使用的时间戳> \
    --nonce-str <签名时使用的随机串> \
    --wechat-pay-public-key-id <微信支付公钥ID> \
    --coupon-code <券码> \
    --openid <用户OpenID> \
    --product-coupon-id <商品券ID> \
    --stock-id <批次ID> \
    --appid <AppID>
"""

import argparse
import json
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import quote


def build_authorization(brand_id: str, serial_no: str, method: str, uri: str,
                        signature: str, timestamp: str, nonce_str: str, body: str = "") -> str:
    """
    构造完整的 Authorization 头。

    使用用户提供的预签名结果（signature + timestamp + nonce_str）直接构造。
    """
    return (
        f'WECHATPAY-BRAND-SHA256-RSA2048 '
        f'brand_id="{brand_id}",'
        f'nonce_str="{nonce_str}",'
        f'signature="{signature}",'
        f'timestamp="{timestamp}",'
        f'serial_no="{serial_no}"'
    )


def print_coupon_analysis(data: dict):
    """解析并结构化输出券的关键信息，方便排障。"""
    print("\n========== 券关键信息 ==========")
    print(f"  券码:         {data.get('coupon_code', '-')}")
    print(f"  券状态:       {data.get('coupon_state', '-')}")
    print(f"  有效期开始:   {data.get('valid_begin_time', '-')}")
    print(f"  有效期结束:   {data.get('valid_end_time', '-')}")
    print(f"  领取时间:     {data.get('receive_time', '-')}")
    print(f"  发放渠道:     {data.get('send_channel', '-')}")

    # 确认发放信息
    if data.get("confirm_time"):
        print(f"  确认发放时间: {data['confirm_time']}")
        print(f"  确认发放单号: {data.get('confirm_request_no', '-')}")
    else:
        print(f"  确认发放时间: 未确认发放")

    # 失效信息
    if data.get("deactivate_time"):
        print(f"  失效时间:     {data['deactivate_time']}")
        print(f"  失效原因:     {data.get('deactivate_reason', '-')}")

    # 单券核销详情
    single_detail = data.get("single_usage_detail")
    if single_detail and single_detail.get("use_time"):
        print(f"  核销时间:     {single_detail['use_time']}")
        print(f"  核销单号:     {single_detail.get('use_request_no', '-')}")
        order_info = single_detail.get("associated_order_info")
        if order_info:
            print(f"  关联订单号:   {order_info.get('transaction_id', '-')}")

    # 多次优惠核销详情
    bundle_detail = data.get("progressive_bundle_usage_detail")
    if bundle_detail and bundle_detail.get("use_time"):
        print(f"  多次优惠核销: {bundle_detail['use_time']}")

    # 多次优惠信息
    bundle_info = data.get("user_product_coupon_bundle_info")
    if bundle_info:
        print(f"  多次优惠总次: {bundle_info.get('total_count', '-')}")
        print(f"  已用次数:     {bundle_info.get('used_count', '-')}")

    print("================================")

    # ====== 自动诊断提示 ======
    state = data.get("coupon_state", "")
    print("\n---------- 自动诊断 ----------")
    if state == "EXPIRED":
        print("⚠️  券已过期（EXPIRED）。")
        print("   → 请对比「有效期结束」时间与你系统记录的有效期是否一致。")
        print("   → 常见原因：有效期起算以回调时间为准，而非发券接口返回时间。")
        if data.get("confirm_time") and data.get("receive_time"):
            print(f"   → 领取时间: {data['receive_time']}，确认发放时间: {data['confirm_time']}")
            print("   → 如果两者间隔较大，说明确认发放延迟消耗了有效期。")
    elif state == "CONFIRMING":
        print("⚠️  券状态为待确认发放（CONFIRMING），尚未调用确认发放接口。")
        print("   → 必须先调「确认发放」接口，券才能进入 EFFECTIVE 可核销状态。")
    elif state == "EFFECTIVE":
        print("✅  券状态正常（EFFECTIVE），可以核销。")
    elif state == "USED":
        print("ℹ️  券已被核销（USED）。")
    elif state == "DELETED":
        print("⚠️  券已被删除（DELETED），可能是用户在微信卡包中手动删除。")
        print("   → 注意：用户卡包删券没有回调通知，商户侧无法实时感知。")
    elif state == "DEACTIVATED":
        print("⚠️  券已失效（DEACTIVATED）。")
        if data.get("deactivate_reason"):
            print(f"   → 失效原因: {data['deactivate_reason']}")
    elif state == "PENDING":
        print("ℹ️  券状态为待生效（PENDING），可能配置了领取后等待N天生效。")
    else:
        print(f"ℹ️  券状态: {state}")
    print("-------------------------------")


def main():
    parser = argparse.ArgumentParser(
        description="品牌直连 - 查询用户商品券详情",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python3 查询用户商品券详情_品牌.py \\
    --brand-id 11490 \\
    --serial-no 2047739FFE173C9C5385A55A9CBF4208AAD91988 \\
    --signature "Base64编码的签名值" \\
    --timestamp 1700000000 \\
    --nonce-str abcdef1234567890 \\
    --wechat-pay-public-key-id PUB_KEY_ID_0123456789 \\
    --coupon-code Code_123456 \\
    --openid oh-394z-6CGkNoJrsDLTTUKiAnp4 \\
    --product-coupon-id 1000000013 \\
    --stock-id 1000000013001 \\
    --appid wx233544546545989
        """,
    )

    # 品牌配置参数
    parser.add_argument("--brand-id", required=True, help="品牌ID")
    parser.add_argument("--serial-no", required=True, help="品牌API证书序列号")
    parser.add_argument("--wechat-pay-public-key-id", required=True, help="微信支付公钥ID")

    # 签名参数（必填）
    sign_group = parser.add_argument_group("签名参数")
    sign_group.add_argument("--signature", required=True, help="用户在自己服务器上生成的 Base64 签名值")
    sign_group.add_argument("--timestamp", required=True, help="签名时使用的时间戳（10位Unix秒）")
    sign_group.add_argument("--nonce-str", required=True, help="签名时使用的随机字符串")

    # 业务参数
    parser.add_argument("--coupon-code", required=True, help="用户券码")
    parser.add_argument("--openid", required=True, help="用户OpenID")
    parser.add_argument("--product-coupon-id", required=True, help="商品券ID")
    parser.add_argument("--stock-id", required=True, help="批次ID")
    parser.add_argument("--appid", required=True, help="AppID")

    args = parser.parse_args()

    # ====== 构造请求 URL ======
    uri = (
        f"/brand/marketing/product-coupon/users/{quote(args.openid, safe='')}"
        f"/coupons/{quote(args.coupon_code, safe='')}"
        f"?product_coupon_id={quote(args.product_coupon_id, safe='')}"
        f"&stock_id={quote(args.stock_id, safe='')}"
        f"&appid={quote(args.appid, safe='')}"
    )
    full_url = f"https://api.mch.weixin.qq.com{uri}"

    # ====== 打印待签名串供用户核对 ======
    method = "GET"
    body = ""
    sign_str = f"{method}\n{uri}\n{args.timestamp}\n{args.nonce_str}\n{body}\n"
    print("========== 预签名核对 ==========")
    print("脚本计算的待签名串（请与您在服务器上使用的待签名串核对）：")
    print("--- 开始 ---")
    print(sign_str, end="")
    print("--- 结束 ---")
    print("如果上述待签名串与您签名时使用的不一致，签名验证将失败。")
    print("================================\n")

    # ====== 构造签名和请求头 ======
    authorization = build_authorization(
        brand_id=args.brand_id,
        serial_no=args.serial_no,
        method="GET",
        uri=uri,
        signature=args.signature,
        timestamp=args.timestamp,
        nonce_str=args.nonce_str,
    )

    # ====== 打印请求信息 ======
    print("========== 查询用户商品券详情 ==========")
    print(f"  品牌ID:   {args.brand_id}")
    print(f"  券码:     {args.coupon_code}")
    print(f"  OpenID:   {args.openid}")
    print(f"  商品券ID: {args.product_coupon_id}")
    print(f"  批次ID:   {args.stock_id}")
    print(f"  AppID:    {args.appid}")
    print("=========================================\n")

    # ====== 发送请求 ======
    req = Request(full_url, method="GET")
    req.add_header("Accept", "application/json")
    req.add_header("Authorization", authorization)
    req.add_header("Wechatpay-Serial", args.wechat_pay_public_key_id)

    try:
        with urlopen(req) as resp:
            status_code = resp.status
            body = resp.read().decode("utf-8")
    except HTTPError as e:
        status_code = e.code
        body = e.read().decode("utf-8")
    except URLError as e:
        print(f"错误: 网络请求失败: {e.reason}", file=sys.stderr)
        sys.exit(1)

    # ====== 输出结果 ======
    print(f"========== 响应结果 ==========")
    print(f"HTTP 状态码: {status_code}")
    print("响应内容:")
    try:
        data = json.loads(body)
        print(json.dumps(data, indent=2, ensure_ascii=False))
    except json.JSONDecodeError:
        print(body)
        print("===============================")
        sys.exit(1)
    print("===============================")

    # ====== 结构化分析 ======
    if 200 <= status_code < 300:
        print_coupon_analysis(data)
    else:
        # 请求失败，输出错误信息
        print("\n---------- 请求失败 ----------")
        print(f"  错误码: {data.get('code', '-')}")
        print(f"  错误信息: {data.get('message', '-')}")
        detail = data.get("detail", {})
        if isinstance(detail, dict) and detail.get("field"):
            print(f"  问题字段: {detail['field']}")
            print(f"  字段错误: {detail.get('issue', '-')}")
        print("-------------------------------")


if __name__ == "__main__":
    main()
