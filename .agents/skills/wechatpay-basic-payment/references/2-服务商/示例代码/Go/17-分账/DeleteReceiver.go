package main

import (
	"bytes"
	"demo/wxpay_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/v3/partner/4015119446
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

func main() {
	config, err := wxpay_utility.CreateMchConfig(
		"19xxxxxxxx",
		"1DDE55AD98Exxxxxxxxxx",
		"/path/to/apiclient_key.pem",
		"PUB_KEY_ID_xxxxxxxxxxxxx",
		"/path/to/wxp_pub.pem",
	)
	if err != nil {
		fmt.Println(err)
		return
	}

	request := &DeleteReceiverRequest{
		SubMchid: wxpay_utility.String("1900000109"),
		Appid:    wxpay_utility.String("wx8888888888888888"),
		SubAppid: wxpay_utility.String("wx8888888888888889"),
		Type:     RECEIVERTYPE_MERCHANT_ID.Ptr(),
		Account:  wxpay_utility.String("1900000109"),
	}

	response, err := DeleteReceiver(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		return
	}

	fmt.Printf("请求成功: %+v\n", response)
}

func DeleteReceiver(config *wxpay_utility.MchConfig, request *DeleteReceiverRequest) (response *DeleteReceiverResponse, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/v3/profitsharing/receivers/delete"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	reqBody, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}
	httpRequest, err := http.NewRequest(method, reqUrl.String(), bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	httpRequest.Header.Set("Accept", "application/json")
	httpRequest.Header.Set("Wechatpay-Serial", config.WechatPayPublicKeyId())
	httpRequest.Header.Set("Content-Type", "application/json")
	authorization, err := wxpay_utility.BuildAuthorization(config.MchId(), config.CertificateSerialNo(), config.PrivateKey(), method, reqUrl.RequestURI(), reqBody)
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
		err = wxpay_utility.ValidateResponse(config.WechatPayPublicKeyId(), config.WechatPayPublicKey(), &httpResponse.Header, respBody)
		if err != nil {
			return nil, err
		}
		response := &DeleteReceiverResponse{}
		if err := json.Unmarshal(respBody, response); err != nil {
			return nil, err
		}
		return response, nil
	} else {
		return nil, wxpay_utility.NewApiException(httpResponse.StatusCode, httpResponse.Header, respBody)
	}
}

type DeleteReceiverRequest struct {
	SubMchid *string       `json:"sub_mchid,omitempty"`
	Appid    *string       `json:"appid,omitempty"`
	SubAppid *string       `json:"sub_appid,omitempty"`
	Type     *ReceiverType `json:"type,omitempty"`
	Account  *string       `json:"account,omitempty"`
}

type DeleteReceiverResponse struct {
	Type    *ReceiverType `json:"type,omitempty"`
	Account *string       `json:"account,omitempty"`
}

type ReceiverType string

func (e ReceiverType) Ptr() *ReceiverType { return &e }

const (
	RECEIVERTYPE_MERCHANT_ID         ReceiverType = "MERCHANT_ID"
	RECEIVERTYPE_PERSONAL_OPENID     ReceiverType = "PERSONAL_OPENID"
	RECEIVERTYPE_PERSONAL_SUB_OPENID ReceiverType = "PERSONAL_SUB_OPENID"
)
