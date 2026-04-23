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
		"19xxxxxxxx",                 // 商户号
		"1DDE55AD98Exxxxxxxxxx",      // 商户API证书序列号
		"/path/to/apiclient_key.pem", // 商户API证书私钥文件路径
		"PUB_KEY_ID_xxxxxxxxxxxxx",   // 微信支付公钥ID
		"/path/to/wxp_pub.pem",       // 微信支付公钥文件路径
	)
	if err != nil {
		fmt.Println(err)
		return
	}

	request := &QueryStateRequest{
		BusinessCode: wxpay_utility.String("1900013511_10000"),
	}

	response, err := QueryState(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		return
	}

	fmt.Printf("请求成功: %+v\n", response)
}

func QueryState(config *wxpay_utility.MchConfig, request *QueryStateRequest) (response *QueryStateResp, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "GET"
		path   = "/v3/applyment4sub/applyment/business_code/{business_code}"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	reqUrl.Path = strings.Replace(reqUrl.Path, "{business_code}", url.PathEscape(*request.BusinessCode), -1)
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
		err = wxpay_utility.ValidateResponse(config.WechatPayPublicKeyId(), config.WechatPayPublicKey(), &httpResponse.Header, respBody)
		if err != nil {
			return nil, err
		}
		response := &QueryStateResp{}
		if err := json.Unmarshal(respBody, response); err != nil {
			return nil, err
		}
		return response, nil
	} else {
		return nil, wxpay_utility.NewApiException(httpResponse.StatusCode, httpResponse.Header, respBody)
	}
}

type QueryStateRequest struct {
	BusinessCode *string `json:"business_code,omitempty"`
}

func (o *QueryStateRequest) MarshalJSON() ([]byte, error) {
	type Alias QueryStateRequest
	a := &struct {
		BusinessCode *string `json:"business_code,omitempty"`
		*Alias
	}{
		BusinessCode: nil,
		Alias:        (*Alias)(o),
	}
	return json.Marshal(a)
}

type QueryStateResp struct {
	BusinessCode      *string         `json:"business_code,omitempty"`
	ApplymentId       *int64          `json:"applyment_id,omitempty"`
	SubMchid          *string         `json:"sub_mchid,omitempty"`
	SignUrl           *string         `json:"sign_url,omitempty"`
	ApplymentState    *ApplymentState `json:"applyment_state,omitempty"`
	ApplymentStateMsg *string         `json:"applyment_state_msg,omitempty"`
	AuditDetail       []AuditDetail   `json:"audit_detail,omitempty"`
}

type ApplymentState string
func (e ApplymentState) Ptr() *ApplymentState { return &e }
const (
	APPLYMENTSTATE_APPLYMENT_STATE_EDITTING        ApplymentState = "APPLYMENT_STATE_EDITTING"
	APPLYMENTSTATE_APPLYMENT_STATE_AUDITING        ApplymentState = "APPLYMENT_STATE_AUDITING"
	APPLYMENTSTATE_APPLYMENT_STATE_REJECTED        ApplymentState = "APPLYMENT_STATE_REJECTED"
	APPLYMENTSTATE_APPLYMENT_STATE_TO_BE_CONFIRMED ApplymentState = "APPLYMENT_STATE_TO_BE_CONFIRMED"
	APPLYMENTSTATE_APPLYMENT_STATE_TO_BE_SIGNED    ApplymentState = "APPLYMENT_STATE_TO_BE_SIGNED"
	APPLYMENTSTATE_APPLYMENT_STATE_FINISHED        ApplymentState = "APPLYMENT_STATE_FINISHED"
	APPLYMENTSTATE_APPLYMENT_STATE_CANCELED        ApplymentState = "APPLYMENT_STATE_CANCELED"
	APPLYMENTSTATE_APPLYMENT_STATE_SIGNING         ApplymentState = "APPLYMENT_STATE_SIGNING"
)

type AuditDetail struct {
	Field        *string `json:"field,omitempty"`
	FieldName    *string `json:"field_name,omitempty"`
	RejectReason *string `json:"reject_reason,omitempty"`
}
