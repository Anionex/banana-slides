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

	request := &GetAuthorizeStateRequest{
		SubMchid: wxpay_utility.String("20001111"),
	}

	response, err := GetAuthorizeState(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}

func GetAuthorizeState(config *wxpay_utility.MchConfig, request *GetAuthorizeStateRequest) (response *GetAuthorizeStateResponse, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "GET"
		path   = "/v3/apply4subject/applyment/merchants/{sub_mchid}/state"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	reqUrl.Path = strings.Replace(reqUrl.Path, "{sub_mchid}", url.PathEscape(*request.SubMchid), -1)
	httpRequest, err := http.NewRequest(method, reqUrl.String(), nil)
	if err != nil {
		return nil, err
	}
	httpRequest.Header.Set("Accept", "application/json")
	httpRequest.Header.Set("Wechatpay-Serial", config.WechatPayPublicKeyId())
	authorization, err := wxpay_utility.BuildAuthorization(config.MchId(), config.CertificateSerialNo(), config.PrivateKey(), method, reqUrl.RequestURI(), nil)
	if err != nil {
		return nil, err
	}
	httpRequest.Header.Set("Authorization", authorization)

	client := &http.Client{}
	httpResponse, err := client.Do(httpRequest)
	if err != nil {
		return nil, err
	}
	respBody, err := wxpay_utility.ExtractResponseBody(httpResponse)
	if err != nil {
		return nil, err
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
			return nil, err
		}
		response := &GetAuthorizeStateResponse{}
		if err := json.Unmarshal(respBody, response); err != nil {
			return nil, err
		}

		return response, nil
	} else {
		return nil, wxpay_utility.NewApiException(
			httpResponse.StatusCode,
			httpResponse.Header,
			respBody,
		)
	}
}

type GetAuthorizeStateRequest struct {
	SubMchid *string `json:"sub_mchid,omitempty"`
}

func (o *GetAuthorizeStateRequest) MarshalJSON() ([]byte, error) {
	type Alias GetAuthorizeStateRequest
	a := &struct {
		SubMchid *string `json:"sub_mchid,omitempty"`
		*Alias
	}{
		// 序列化时移除非 Body 字段
		SubMchid: nil,
		Alias:    (*Alias)(o),
	}
	return json.Marshal(a)
}

type GetAuthorizeStateResponse struct {
	AuthorizeState *AuthorizeState `json:"authorize_state,omitempty"`
}

type AuthorizeState string

func (e AuthorizeState) Ptr() *AuthorizeState {
	return &e
}

const (
	AUTHORIZESTATE_AUTHORIZE_STATE_UNAUTHORIZED AuthorizeState = "AUTHORIZE_STATE_UNAUTHORIZED"
	AUTHORIZESTATE_AUTHORIZE_STATE_AUTHORIZED   AuthorizeState = "AUTHORIZE_STATE_AUTHORIZED"
)
