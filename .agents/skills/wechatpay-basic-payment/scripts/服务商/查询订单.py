#!/usr/bin/env python3
"""
查询订单（服务商模式 - 商户订单号查单）
API文档：https://pay.weixin.qq.com/doc/v3/partner/4012085858

依赖：Python3（macOS/Linux 自带）
无需 pip install 任何第三方库。

所有参数通过命令行传入，脚本内不硬编码任何配置。
模型负责交互式收集参数，拼装命令行调用本脚本。

签名模式：用户在自己的服务器上完成签名后，将签名值（Base64）、时间戳、随机串传入，
脚本直接使用这些值构造 Authorization 头并发送请求。

与商户版的区别：
  - API 路径为 /v3/pay/partner/transactions/...
  - 查询参数使用 sp_mchid + sub_mchid（而非 mchid）
  - Authorization 头中的 mchid 为服务商商户号（sp_mchid）
  - 响应中包含 sp_mchid/sub_mchid/sp_appid/sub_appid

用法：
  python3 查询订单.py \
    --sp-mchid <服务商商户号> \
    --sub-mchid <子商户号> \
    --serial-no <API证书序列号> \
    --signature <Base64签名值> \
    --timestamp <签名时使用的时间戳> \
    --nonce-str <签名时使用的随机串> \
    --wechat-pay-public-key-id <微信支付公钥ID> \
    --out-trade-no <商户订单号>
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


def print_order_analysis(data):
    """解析订单关键信息。"""
    print("\n========== 订单关键信息 ==========")
    print(f"  商户订单号:     {data.get('out_trade_no', '-')}")
    print(f"  微信订单号:     {data.get('transaction_id', '-')}")
    print(f"  交易状态:       {data.get('trade_state', '-')}")
    print(f"  交易状态描述:   {data.get('trade_state_desc', '-')}")
    print(f"  交易类型:       {data.get('trade_type', '-')}")
    print(f"  服务商商户号:   {data.get('sp_mchid', '-')}")
    print(f"  子商户号:       {data.get('sub_mchid', '-')}")
    print(f"  sp_appid:       {data.get('sp_appid', '-')}")
    print(f"  sub_appid:      {data.get('sub_appid', '-')}")

    amount = data.get("amount", {})
    print(f"  订单金额(分):   {amount.get('total', '-')}")
    print(f"  用户支付(分):   {amount.get('payer_total', '-')}")

    if data.get("success_time"):
        print(f"  支付完成时间:   {data['success_time']}")
    print("==================================")

    state = data.get("trade_state", "")
    print("\n---------- 自动诊断 ----------")
    if state == "SUCCESS":
        print("✅  订单已支付成功。")
        print(f"   → 微信订单号: {data.get('transaction_id', '-')}")
        print("   → 如需退款，请使用此 transaction_id 调用退款接口。")
    elif state == "NOTPAY":
        print("⚠️  订单未支付（NOTPAY）。")
        print("   → 用户尚未完成支付，或 prepay_id 已过期（2小时）需重新下单。")
        print("   → 如不再需要此订单，建议调用关单接口关闭。")
    elif state == "CLOSED":
        print("⚠️  订单已关闭（CLOSED）。")
        print("   → 订单已被商户主动关单或超时自动关闭，需用新的 out_trade_no 重新下单。")
    elif state == "REFUND":
        print("ℹ️  订单转入退款（REFUND）。")
        print("   → 已有退款发起，可用退款查询脚本确认退款状态。")
    elif state == "USERPAYING":
        print("⏳  用户支付中（USERPAYING），常见于付款码支付。")
        print("   → 需轮询查单直到终态（SUCCESS/CLOSED），超时后调用撤销接口。")
    elif state == "PAYERROR":
        print("❌  支付失败（PAYERROR）。")
        print("   → 付款码场景需调用撤销接口，其他场景需重新下单。")
    else:
        print(f"ℹ️  交易状态: {state}")
    print("-------------------------------")


def main():
    parser = argparse.ArgumentParser(
        description="查询订单（服务商模式 - 商户订单号查单）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument("--sp-mchid", required=True, help="服务商商户号")
    parser.add_argument("--sub-mchid", required=True, help="子商户号")
    parser.add_argument("--serial-no", required=True, help="API证书序列号")
    parser.add_argument("--wechat-pay-public-key-id", required=True, help="微信支付公钥ID")

    sign_group = parser.add_argument_group("签名参数")
    sign_group.add_argument("--signature", required=True, help="用户在自己服务器上生成的 Base64 签名值")
    sign_group.add_argument("--timestamp", required=True, help="签名时使用的时间戳（10位Unix秒）")
    sign_group.add_argument("--nonce-str", required=True, help="签名时使用的随机字符串")

    parser.add_argument("--out-trade-no", required=True, help="商户订单号")

    args = parser.parse_args()

    uri = (
        f"/v3/pay/partner/transactions/out-trade-no/{quote(args.out_trade_no, safe='')}"
        f"?sp_mchid={quote(args.sp_mchid, safe='')}"
        f"&sub_mchid={quote(args.sub_mchid, safe='')}"
    )
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
        mchid=args.sp_mchid,
        serial_no=args.serial_no,
        signature=args.signature,
        timestamp=args.timestamp,
        nonce_str=args.nonce_str,
    )

    print("========== 查询订单 ==========")
    print(f"  服务商商户号: {args.sp_mchid}")
    print(f"  子商户号:     {args.sub_mchid}")
    print(f"  订单号:       {args.out_trade_no}")
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
        print_order_analysis(data)
    else:
        print("\n---------- 请求失败 ----------")
        print(f"  错误码: {data.get('code', '-')}")
        print(f"  错误信息: {data.get('message', '-')}")
        if data.get("code") == "ORDER_NOT_EXIST":
            print("   → 订单不存在，请确认：")
            print("     1. 订单号是否正确（注意大小写和空格）")
            print("     2. sp_mchid 和 sub_mchid 是否与下单时一致")
            print("     3. 如果是合单订单，需使用合单查单接口")
        elif data.get("code") == "INVALID_REQUEST":
            print("   → 请检查 sub_mchid 是否正确，以及受理关系是否存在")
        print("-------------------------------")


if __name__ == "__main__":
    main()
