// 关闭订单
//
// 未支付状态的订单，可在无需支付时调用此接口关闭订单。常见关单情况包括：
// 1. 用户在商户系统提交取消订单请求，商户需执行关单操作。
// 2. 订单超时未支付（超出商户系统设定的可支付时间或下单时的time_expire支付截止时间），商户需进行关单处理。

package main

import (
	"bytes"
	"demo/wxpay_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/v3/merchant/4015119334
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

func main() {
	// TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/merchant/4013070756
	config, err := wxpay_utility.CreateMchConfig(
		"19xxxxxxxx",                 // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考 https://pay.weixin.qq.com/doc/v3/merchant/4013070756
		"1DDE55AD98Exxxxxxxxxx",      // 商户API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/v3/merchant/4013053053
		"/path/to/apiclient_key.pem", // 商户API证书私钥文件路径，本地文件路径
		"PUB_KEY_ID_xxxxxxxxxxxxx",   // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/v3/merchant/4013038816
		"/path/to/wxp_pub.pem",       // 微信支付公钥文件路径，本地文件路径
	)
	if err != nil {
		fmt.Println(err)
		return
	}

	request := &CloseOrderRequest{
		OutTradeNo: wxpay_utility.String("1217752501201407033233368018"),
		Mchid:      wxpay_utility.String("1230000109"),
	}

	err = CloseOrder(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Println("请求成功")
}

// CloseOrder 关闭订单
//
// 未支付状态的订单，可在无需支付时调用此接口关闭订单。常见关单情况包括：
// 1. 用户在商户系统提交取消订单请求，商户需执行关单操作。
// 2. 订单超时未支付（超出商户系统设定的可支付时间或下单时的time_expire支付截止时间），商户需进行关单处理。
func CloseOrder(config *wxpay_utility.MchConfig, request *CloseOrderRequest) (err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/v3/pay/transactions/out-trade-no/{out_trade_no}/close"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return err
	}
	reqUrl.Path = strings.Replace(reqUrl.Path, "{out_trade_no}", url.PathEscape(*request.OutTradeNo), -1)
	reqBody, err := json.Marshal(request)
	if err != nil {
		return err
	}
	httpRequest, err := http.NewRequest(method, reqUrl.String(), bytes.NewReader(reqBody))
	if err != nil {
		return err
	}
	httpRequest.Header.Set("Accept", "application/json")
	httpRequest.Header.Set("Wechatpay-Serial", config.WechatPayPublicKeyId())
	httpRequest.Header.Set("Content-Type", "application/json")
	authorization, err := wxpay_utility.BuildAuthorization(config.MchId(), config.CertificateSerialNo(), config.PrivateKey(), method, reqUrl.RequestURI(), reqBody)
	if err != nil {
		return err
	}
	httpRequest.Header.Set("Authorization", authorization)

	client := &http.Client{}
	httpResponse, err := client.Do(httpRequest)
	if err != nil {
		return err
	}
	respBody, err := wxpay_utility.ExtractResponseBody(httpResponse)
	if err != nil {
		return err
	}
	if httpResponse.StatusCode >= 200 && httpResponse.StatusCode < 300 {
		// 2XX 成功，验证应答签名
		err = wxpay_utility.ValidateResponse(
			config.WechatPayPublicKeyId(),
			config.WechatPayPublicKey(),
			&httpResponse.Header,
			respBody,
		)
		if err != nil {
			return err
		}
		return nil
	} else {
		return wxpay_utility.NewApiException(
			httpResponse.StatusCode,
			httpResponse.Header,
			respBody,
		)
	}
}

type CloseOrderRequest struct {
	Mchid      *string `json:"mchid,omitempty"`
	OutTradeNo *string `json:"out_trade_no,omitempty"`
}

func (o *CloseOrderRequest) MarshalJSON() ([]byte, error) {
	type Alias CloseOrderRequest
	a := &struct {
		OutTradeNo *string `json:"out_trade_no,omitempty"`
		*Alias
	}{
		// 序列化时移除非 Body 字段
		OutTradeNo: nil,
		Alias:      (*Alias)(o),
	}
	return json.Marshal(a)
}
