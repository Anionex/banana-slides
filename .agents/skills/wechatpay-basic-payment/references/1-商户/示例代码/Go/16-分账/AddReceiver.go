package main

import (
	"bytes"
	"demo/wxpay_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/v3/merchant/4015119334
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
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

	request := &AddReceiverRequest{
		Appid:          wxpay_utility.String("wx8888888888888888"),
		Type:           RECEIVERTYPE_MERCHANT_ID.Ptr(),
		Account:        wxpay_utility.String("86693852"),
		Name:           wxpay_utility.String("hu89ohu89ohu89o"), /*请传入wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
		RelationType:   RECEIVERRELATIONTYPE_STORE.Ptr(),
		CustomRelation: wxpay_utility.String("代理商"),
	}

	response, err := AddReceiver(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
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
		response := &AddReceiverResponse{}
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

type AddReceiverRequest struct {
	Appid          *string               `json:"appid,omitempty"`
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

func (e ReceiverType) Ptr() *ReceiverType {
	return &e
}

const (
	RECEIVERTYPE_MERCHANT_ID     ReceiverType = "MERCHANT_ID"
	RECEIVERTYPE_PERSONAL_OPENID ReceiverType = "PERSONAL_OPENID"
)

type ReceiverRelationType string

func (e ReceiverRelationType) Ptr() *ReceiverRelationType {
	return &e
}

const (
	RECEIVERRELATIONTYPE_STORE       ReceiverRelationType = "STORE"
	RECEIVERRELATIONTYPE_STAFF       ReceiverRelationType = "STAFF"
	RECEIVERRELATIONTYPE_STORE_OWNER ReceiverRelationType = "STORE_OWNER"
	RECEIVERRELATIONTYPE_PARTNER     ReceiverRelationType = "PARTNER"
	RECEIVERRELATIONTYPE_HEADQUARTER ReceiverRelationType = "HEADQUARTER"
	RECEIVERRELATIONTYPE_BRAND       ReceiverRelationType = "BRAND"
	RECEIVERRELATIONTYPE_DISTRIBUTOR ReceiverRelationType = "DISTRIBUTOR"
	RECEIVERRELATIONTYPE_USER        ReceiverRelationType = "USER"
	RECEIVERRELATIONTYPE_SUPPLIER    ReceiverRelationType = "SUPPLIER"
	RECEIVERRELATIONTYPE_CUSTOM      ReceiverRelationType = "CUSTOM"
)

删除分账接收方
