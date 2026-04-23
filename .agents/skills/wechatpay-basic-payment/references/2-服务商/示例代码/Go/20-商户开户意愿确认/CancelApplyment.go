package main

import (
	"demo/wxpay_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/v3/partner/4015119446
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

func main() {
	// TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/partner/4013080340
	config, err := wxpay_utility.CreateMchConfig(
		"19xxxxxxxx",                 // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考 https://pay.weixin.qq.com/doc/v3/partner/4013080340
		"1DDE55AD98Exxxxxxxxxx",      // 商户API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013058924
		"/path/to/apiclient_key.pem", // 商户API证书私钥文件路径，本地文件路径
		"PUB_KEY_ID_xxxxxxxxxxxxx",   // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013038589
		"/path/to/wxp_pub.pem",       // 微信支付公钥文件路径，本地文件路径
	)
	if err != nil {
		fmt.Println(err)
		return
	}

	request := &CancelApplymentRequest{
		ApplymentId:  wxpay_utility.Int64(20000011111),
		BusinessCode: wxpay_utility.String("1900013511_10000"),
	}

	err = CancelApplyment(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Println("请求成功")
}

func CancelApplyment(config *wxpay_utility.MchConfig, request *CancelApplymentRequest) (err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/v3/apply4subject/applyment/{business_code}/cancel"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return err
	}
	reqUrl.Path = strings.Replace(reqUrl.Path, "{business_code}", url.PathEscape(*request.BusinessCode), -1)
	query := reqUrl.Query()
	if request.ApplymentId != nil {
		query.Add("applyment_id", fmt.Sprintf("%v", *request.ApplymentId))
	}
	reqUrl.RawQuery = query.Encode()
	httpRequest, err := http.NewRequest(method, reqUrl.String(), nil)
	if err != nil {
		return err
	}
	httpRequest.Header.Set("Accept", "application/json")
	httpRequest.Header.Set("Wechatpay-Serial", config.WechatPayPublicKeyId())
	httpRequest.Header.Set("Content-Type", "application/json")
	authorization, err := wxpay_utility.BuildAuthorization(config.MchId(), config.CertificateSerialNo(), config.PrivateKey(), method, reqUrl.RequestURI(), nil)
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

type CancelApplymentRequest struct {
	ApplymentId  *int64  `json:"applyment_id,omitempty"`
	BusinessCode *string `json:"business_code,omitempty"`
}

func (o *CancelApplymentRequest) MarshalJSON() ([]byte, error) {
	type Alias CancelApplymentRequest
	a := &struct {
		ApplymentId  *int64  `json:"applyment_id,omitempty"`
		BusinessCode *string `json:"business_code,omitempty"`
		*Alias
	}{
		// 序列化时移除非 Body 字段
		ApplymentId:  nil,
		BusinessCode: nil,
		Alias:        (*Alias)(o),
	}
	return json.Marshal(a)
}
