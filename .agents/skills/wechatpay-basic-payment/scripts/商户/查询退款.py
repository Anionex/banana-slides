#!/usr/bin/env python3
"""
查询单笔退款（通过商户退款单号）
API文档：https://pay.weixin.qq.com/doc/v3/merchant/4012791948

依赖：Python3（macOS/Linux 自带）
无需 pip install 任何第三方库。

所有参数通过命令行传入，脚本内不硬编码任何配置。
模型负责交互式收集参数，拼装命令行调用本脚本。

签名模式：用户在自己的服务器上完成签名后，将签名值（Base64）、时间戳、随机串传入，
脚本直接使用这些值构造 Authorization 头并发送请求。

用法：
  python3 查询退款.py \
    --mchid <商户号> \
    --serial-no <API证书序列号> \
    --signature <Base64签名值> \
    --timestamp <签名时使用的时间戳> \
    --nonce-str <签名时使用的随机串> \
    --wechat-pay-public-key-id <微信支付公钥ID> \
    --out-refund-no <商户退款单号>
"""

import argparse
import json
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import quote


def build_authorization(mchid, serial_no, signature, timestamp, nonce_str):
    return (
        f'WECHATPAY2-SHA256-RSA2048 '
        f'mchid="{mchid}",'
        f'nonce_str="{nonce_str}",'
        f'signature="{signature}",'
        f'timestamp="{timestamp}",'
        f'serial_no="{serial_no}"'
    )


def print_refund_analysis(data):
    """解析退款单关键信息。"""
    print("\n========== 退款单关键信息 ==========")
    print(f"  微信退款单号:   {data.get('refund_id', '-')}")
    print(f"  商户退款单号:   {data.get('out_refund_no', '-')}")
    print(f"  微信订单号:     {data.get('transaction_id', '-')}")
    print(f"  商户订单号:     {data.get('out_trade_no', '-')}")
    print(f"  退款状态:       {data.get('status', '-')}")
    print(f"  退款渠道:       {data.get('channel', '-')}")
    print(f"  退款入账账户:   {data.get('user_received_account', '-')}")
    print(f"  退款创建时间:   {data.get('create_time', '-')}")
    if data.get("success_time"):
        print(f"  退款成功时间:   {data['success_time']}")

    amount = data.get("amount", {})
    print(f"  退款金额(分):   {amount.get('refund', '-')}")
    print(f"  原订单金额(分): {amount.get('total', '-')}")
    print(f"  用户退款(分):   {amount.get('payer_refund', '-')}")
    print(f"  资金账户:       {data.get('funds_account', '-')}")
    print("====================================")

    status = data.get("status", "")
    print("\n---------- 自动诊断 ----------")
    if status == "SUCCESS":
        print("✅  退款成功，资金已退回用户。")
        print(f"   → 退款入账: {data.get('user_received_account', '-')}")
        print(f"   → 成功时间: {data.get('success_time', '-')}")
    elif status == "PROCESSING":
        print("⏳  退款处理中（PROCESSING）。")
        print("   → 退款正在处理，通常 1-3 个工作日到账。")
        print("   → 银行卡退款可能需要更长时间，请耐心等待。")
        print("   → 可通过退款回调通知或定期查询确认最终结果。")
    elif status == "ABNORMAL":
        print("❌  退款异常（ABNORMAL）。")
        print("   → 退款到银行发现用户账户异常或已注销，资金已退回商户。")
        print("   → 需调用「发起异常退款」接口，提供其他退款账户信息重新退款。")
        print("   → 代码示例: Java/8-订单退款/CreateAbnormalRefund.java")
    elif status == "CLOSED":
        print("⚠️  退款关闭（CLOSED）。")
        print("   → 退款失败或被关闭，资金未退出。")
        print("   → 如仍需退款，请使用新的 out_refund_no 重新发起退款申请。")
    else:
        print(f"ℹ️  退款状态: {status}")
    print("-------------------------------")


def main():
    parser = argparse.ArgumentParser(
        description="查询单笔退款（通过商户退款单号）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument("--mchid", required=True, help="商户号")
    parser.add_argument("--serial-no", required=True, help="API证书序列号")
    parser.add_argument("--wechat-pay-public-key-id", required=True, help="微信支付公钥ID")

    sign_group = parser.add_argument_group("签名参数")
    sign_group.add_argument("--signature", required=True, help="用户在自己服务器上生成的 Base64 签名值")
    sign_group.add_argument("--timestamp", required=True, help="签名时使用的时间戳（10位Unix秒）")
    sign_group.add_argument("--nonce-str", required=True, help="签名时使用的随机字符串")

    parser.add_argument("--out-refund-no", required=True, help="商户退款单号")

    args = parser.parse_args()

    uri = f"/v3/refund/domestic/refunds/{quote(args.out_refund_no, safe='')}"
    full_url = f"https://api.mch.weixin.qq.com{uri}"

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

    authorization = build_authorization(
        mchid=args.mchid,
        serial_no=args.serial_no,
        signature=args.signature,
        timestamp=args.timestamp,
        nonce_str=args.nonce_str,
    )

    print("========== 查询退款 ==========")
    print(f"  商户号:       {args.mchid}")
    print(f"  退款单号:     {args.out_refund_no}")
    print("================================\n")

    req = Request(full_url, method="GET")
    req.add_header("Accept", "application/json")
    req.add_header("Authorization", authorization)
    req.add_header("Wechatpay-Serial", args.wechat_pay_public_key_id)

    try:
        with urlopen(req) as resp:
            status_code = resp.status
            resp_body = resp.read().decode("utf-8")
    except HTTPError as e:
        status_code = e.code
        resp_body = e.read().decode("utf-8")
    except URLError as e:
        print(f"错误: 网络请求失败: {e.reason}", file=sys.stderr)
        sys.exit(1)

    print(f"========== 响应结果 ==========")
    print(f"HTTP 状态码: {status_code}")
    print("响应内容:")
    try:
        data = json.loads(resp_body)
        print(json.dumps(data, indent=2, ensure_ascii=False))
    except json.JSONDecodeError:
        print(resp_body)
        print("===============================")
        sys.exit(1)
    print("===============================")

    if 200 <= status_code < 300:
        print_refund_analysis(data)
    else:
        print("\n---------- 请求失败 ----------")
        print(f"  错误码: {data.get('code', '-')}")
        print(f"  错误信息: {data.get('message', '-')}")
        if data.get("code") == "RESOURCE_NOT_EXISTS":
            print("   → 退款单不存在，请确认：")
            print("     1. 商户退款单号是否正确")
            print("     2. 退款是否已成功发起（检查退款申请接口返回）")
        print("-------------------------------")


if __name__ == "__main__":
    main()
