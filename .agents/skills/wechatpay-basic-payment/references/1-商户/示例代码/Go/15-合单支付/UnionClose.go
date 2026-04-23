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

	request := &UnionCloseRequest{
		CombineOutTradeNo: wxpay_utility.String("1217752501201407033233368018"),
		CombineAppid:      wxpay_utility.String("wxd678efh567hg6787"),
		SubOrders: []UnionCloseSubOrder{UnionCloseSubOrder{
			Mchid:      wxpay_utility.String("1900000109"),
			OutTradeNo: wxpay_utility.String("20150806125346"),
		}},
	}

	err = UnionClose(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Println("请求成功")
}

func UnionClose(config *wxpay_utility.MchConfig, request *UnionCloseRequest) (err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/v3/combine-transactions/out-trade-no/{combine_out_trade_no}/close"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return err
	}
	reqUrl.Path = strings.Replace(reqUrl.Path, "{combine_out_trade_no}", url.PathEscape(*request.CombineOutTradeNo), -1)
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

type UnionCloseRequest struct {
	CombineAppid      *string              `json:"combine_appid,omitempty"`
	CombineOutTradeNo *string              `json:"combine_out_trade_no,omitempty"`
	SubOrders         []UnionCloseSubOrder `json:"sub_orders,omitempty"`
}

func (o *UnionCloseRequest) MarshalJSON() ([]byte, error) {
	type Alias UnionCloseRequest
	a := &struct {
		CombineOutTradeNo *string `json:"combine_out_trade_no,omitempty"`
		*Alias
	}{
		// 序列化时移除非 Body 字段
		CombineOutTradeNo: nil,
		Alias:             (*Alias)(o),
	}
	return json.Marshal(a)
}

type UnionCloseSubOrder struct {
	Mchid      *string `json:"mchid,omitempty"`
	OutTradeNo *string `json:"out_trade_no,omitempty"`
}
