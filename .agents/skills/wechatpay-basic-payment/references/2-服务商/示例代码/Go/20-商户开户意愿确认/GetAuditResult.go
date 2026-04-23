package main

import (
	"demo/wxpay_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/v3/partner/4015119446
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
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

	request := &GetAuditResultRequest{
		ApplymentId:  wxpay_utility.Int64(20000011111),
		BusinessCode: wxpay_utility.String("1900013511_10000"),
	}

	response, err := GetAuditResult(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}

func GetAuditResult(config *wxpay_utility.MchConfig, request *GetAuditResultRequest) (response *GetAuditResultResponse, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "GET"
		path   = "/v3/apply4subject/applyment"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	query := reqUrl.Query()
	if request.ApplymentId != nil {
		query.Add("applyment_id", fmt.Sprintf("%v", *request.ApplymentId))
	}
	if request.BusinessCode != nil {
		query.Add("business_code", *request.BusinessCode)
	}
	reqUrl.RawQuery = query.Encode()
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
		response := &GetAuditResultResponse{}
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

type GetAuditResultRequest struct {
	ApplymentId  *int64  `json:"applyment_id,omitempty"`
	BusinessCode *string `json:"business_code,omitempty"`
}

func (o *GetAuditResultRequest) MarshalJSON() ([]byte, error) {
	type Alias GetAuditResultRequest
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

type GetAuditResultResponse struct {
	ApplymentState *ApplymentState `json:"applyment_state,omitempty"`
	QrcodeData     *string         `json:"qrcode_data,omitempty"`
	RejectParam    *string         `json:"reject_param,omitempty"`
	RejectReason   *string         `json:"reject_reason,omitempty"`
}

type ApplymentState string

func (e ApplymentState) Ptr() *ApplymentState {
	return &e
}

const (
	APPLYMENTSTATE_APPLYMENT_STATE_EDITTING                         ApplymentState = "APPLYMENT_STATE_EDITTING"
	APPLYMENTSTATE_APPLYMENT_STATE_WAITTING_FOR_AUDIT               ApplymentState = "APPLYMENT_STATE_WAITTING_FOR_AUDIT"
	APPLYMENTSTATE_APPLYMENT_STATE_WAITTING_FOR_CONFIRM_CONTACT     ApplymentState = "APPLYMENT_STATE_WAITTING_FOR_CONFIRM_CONTACT"
	APPLYMENTSTATE_APPLYMENT_STATE_WAITTING_FOR_CONFIRM_LEGALPERSON ApplymentState = "APPLYMENT_STATE_WAITTING_FOR_CONFIRM_LEGALPERSON"
	APPLYMENTSTATE_APPLYMENT_STATE_PASSED                           ApplymentState = "APPLYMENT_STATE_PASSED"
	APPLYMENTSTATE_APPLYMENT_STATE_REJECTED                         ApplymentState = "APPLYMENT_STATE_REJECTED"
	APPLYMENTSTATE_APPLYMENT_STATE_FREEZED                          ApplymentState = "APPLYMENT_STATE_FREEZED"
	APPLYMENTSTATE_APPLYMENT_STATE_CANCELED                         ApplymentState = "APPLYMENT_STATE_CANCELED"
)
