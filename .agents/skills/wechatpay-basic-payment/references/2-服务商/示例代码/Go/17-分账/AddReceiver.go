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

	request := &AddReceiverRequest{
		SubMchid:       wxpay_utility.String("1900000109"),
		Appid:          wxpay_utility.String("wx8888888888888888"),
		SubAppid:       wxpay_utility.String("wx8888888888888889"),
		Type:           RECEIVERTYPE_MERCHANT_ID.Ptr(),
		Account:        wxpay_utility.String("86693852"),
		Name:           wxpay_utility.String("hu89ohu89ohu89o"), /*请传入wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
		RelationType:   RECEIVERRELATIONTYPE_STORE.Ptr(),
		CustomRelation: wxpay_utility.String("代理商"),
	}

	response, err := AddReceiver(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		return
	}

	fmt.Printf("请求成功: %+v\n", response)
}

func AddReceiver(config *wxpay_utility.MchConfig, request *AddReceiverRequest) (response *AddReceiverResponse, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/v3/profitsharing/receivers/add"
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
		response := &AddReceiverResponse{}
		if err := json.Unmarshal(respBody, response); err != nil {
			return nil, err
		}
		return response, nil
	} else {
		return nil, wxpay_utility.NewApiException(httpResponse.StatusCode, httpResponse.Header, respBody)
	}
}

type AddReceiverRequest struct {
	SubMchid       *string               `json:"sub_mchid,omitempty"`
	Appid          *string               `json:"appid,omitempty"`
	SubAppid       *string               `json:"sub_appid,omitempty"`
	Type           *ReceiverType         `json:"type,omitempty"`
	Account        *string               `json:"account,omitempty"`
	Name           *string               `json:"name,omitempty"`
	RelationType   *ReceiverRelationType `json:"relation_type,omitempty"`
	CustomRelation *string               `json:"custom_relation,omitempty"`
}

type AddReceiverResponse struct {
	Type           *ReceiverType         `json:"type,omitempty"`
	Account        *string               `json:"account,omitempty"`
	Name           *string               `json:"name,omitempty"`
	RelationType   *ReceiverRelationType `json:"relation_type,omitempty"`
	CustomRelation *string               `json:"custom_relation,omitempty"`
}

type ReceiverType string

func (e ReceiverType) Ptr() *ReceiverType { return &e }

const (
	RECEIVERTYPE_MERCHANT_ID         ReceiverType = "MERCHANT_ID"
	RECEIVERTYPE_PERSONAL_OPENID     ReceiverType = "PERSONAL_OPENID"
	RECEIVERTYPE_PERSONAL_SUB_OPENID ReceiverType = "PERSONAL_SUB_OPENID"
)

type ReceiverRelationType string

func (e ReceiverRelationType) Ptr() *ReceiverRelationType { return &e }

const (
	RECEIVERRELATIONTYPE_STORE            ReceiverRelationType = "STORE"
	RECEIVERRELATIONTYPE_STAFF            ReceiverRelationType = "STAFF"
	RECEIVERRELATIONTYPE_STORE_OWNER      ReceiverRelationType = "STORE_OWNER"
	RECEIVERRELATIONTYPE_PARTNER          ReceiverRelationType = "PARTNER"
	RECEIVERRELATIONTYPE_HEADQUARTER      ReceiverRelationType = "HEADQUARTER"
	RECEIVERRELATIONTYPE_BRAND            ReceiverRelationType = "BRAND"
	RECEIVERRELATIONTYPE_DISTRIBUTOR      ReceiverRelationType = "DISTRIBUTOR"
	RECEIVERRELATIONTYPE_USER             ReceiverRelationType = "USER"
	RECEIVERRELATIONTYPE_SUPPLIER         ReceiverRelationType = "SUPPLIER"
	RECEIVERRELATIONTYPE_CUSTOM           ReceiverRelationType = "CUSTOM"
	RECEIVERRELATIONTYPE_SERVICE_PROVIDER ReceiverRelationType = "SERVICE_PROVIDER"
)
