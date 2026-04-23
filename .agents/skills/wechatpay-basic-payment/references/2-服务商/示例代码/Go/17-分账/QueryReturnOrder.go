package main

import (
	"demo/wxpay_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/v3/partner/4015119446
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
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

	request := &QueryReturnOrderRequest{
		OutReturnNo: wxpay_utility.String("R20190516001"),
		SubMchid:    wxpay_utility.String("1900000109"),
		OutOrderNo:  wxpay_utility.String("P20190806125346"),
	}

	response, err := QueryReturnOrder(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		return
	}

	fmt.Printf("请求成功: %+v\n", response)
}

func QueryReturnOrder(config *wxpay_utility.MchConfig, request *QueryReturnOrderRequest) (response *ReturnOrdersEntity, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "GET"
		path   = "/v3/profitsharing/return-orders/{out_return_no}"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	reqUrl.Path = strings.Replace(reqUrl.Path, "{out_return_no}", url.PathEscape(*request.OutReturnNo), -1)
	query := reqUrl.Query()
	if request.SubMchid != nil {
		query.Add("sub_mchid", *request.SubMchid)
	}
	if request.OutOrderNo != nil {
		query.Add("out_order_no", *request.OutOrderNo)
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
		err = wxpay_utility.ValidateResponse(config.WechatPayPublicKeyId(), config.WechatPayPublicKey(), &httpResponse.Header, respBody)
		if err != nil {
			return nil, err
		}
		response := &ReturnOrdersEntity{}
		if err := json.Unmarshal(respBody, response); err != nil {
			return nil, err
		}
		return response, nil
	} else {
		return nil, wxpay_utility.NewApiException(httpResponse.StatusCode, httpResponse.Header, respBody)
	}
}

type QueryReturnOrderRequest struct {
	OutReturnNo *string `json:"out_return_no,omitempty"`
	SubMchid    *string `json:"sub_mchid,omitempty"`
	OutOrderNo  *string `json:"out_order_no,omitempty"`
}

func (o *QueryReturnOrderRequest) MarshalJSON() ([]byte, error) {
	type Alias QueryReturnOrderRequest
	a := &struct {
		OutReturnNo *string `json:"out_return_no,omitempty"`
		SubMchid    *string `json:"sub_mchid,omitempty"`
		OutOrderNo  *string `json:"out_order_no,omitempty"`
		*Alias
	}{
		OutReturnNo: nil,
		SubMchid:    nil,
		OutOrderNo:  nil,
		Alias:       (*Alias)(o),
	}
	return json.Marshal(a)
}

type ReturnOrdersEntity struct {
	SubMchid    *string                `json:"sub_mchid,omitempty"`
	OrderId     *string                `json:"order_id,omitempty"`
	OutOrderNo  *string                `json:"out_order_no,omitempty"`
	OutReturnNo *string                `json:"out_return_no,omitempty"`
	ReturnId    *string                `json:"return_id,omitempty"`
	ReturnMchid *string                `json:"return_mchid,omitempty"`
	Amount      *int64                 `json:"amount,omitempty"`
	Description *string                `json:"description,omitempty"`
	Result      *ReturnOrderStatus     `json:"result,omitempty"`
	FailReason  *ReturnOrderFailReason `json:"fail_reason,omitempty"`
	CreateTime  *time.Time             `json:"create_time,omitempty"`
	FinishTime  *time.Time             `json:"finish_time,omitempty"`
}

type ReturnOrderStatus string

func (e ReturnOrderStatus) Ptr() *ReturnOrderStatus { return &e }

const (
	RETURNORDERSTATUS_PROCESSING ReturnOrderStatus = "PROCESSING"
	RETURNORDERSTATUS_SUCCESS    ReturnOrderStatus = "SUCCESS"
	RETURNORDERSTATUS_FAILED     ReturnOrderStatus = "FAILED"
)

type ReturnOrderFailReason string

func (e ReturnOrderFailReason) Ptr() *ReturnOrderFailReason { return &e }

const (
	RETURNORDERFAILREASON_ACCOUNT_ABNORMAL       ReturnOrderFailReason = "ACCOUNT_ABNORMAL"
	RETURNORDERFAILREASON_BALANCE_NOT_ENOUGH     ReturnOrderFailReason = "BALANCE_NOT_ENOUGH"
	RETURNORDERFAILREASON_TIME_OUT_CLOSED        ReturnOrderFailReason = "TIME_OUT_CLOSED"
	RETURNORDERFAILREASON_PAYER_ACCOUNT_ABNORMAL ReturnOrderFailReason = "PAYER_ACCOUNT_ABNORMAL"
	RETURNORDERFAILREASON_INVALID_REQUEST        ReturnOrderFailReason = "INVALID_REQUEST"
)
