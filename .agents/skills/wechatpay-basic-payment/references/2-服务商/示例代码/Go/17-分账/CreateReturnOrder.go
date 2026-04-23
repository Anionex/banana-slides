package main

import (
	"bytes"
	"demo/wxpay_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/v3/partner/4015119446
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
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

	request := &CreateReturnOrderRequest{
		SubMchid:    wxpay_utility.String("1900000109"),
		OrderId:     wxpay_utility.String("3008450740201411110007820472"),
		OutOrderNo:  wxpay_utility.String("P20150806125346"),
		OutReturnNo: wxpay_utility.String("R20190516001"),
		ReturnMchid: wxpay_utility.String("86693852"),
		Amount:      wxpay_utility.Int64(10),
		Description: wxpay_utility.String("用户退款"),
	}

	response, err := CreateReturnOrder(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		return
	}

	fmt.Printf("请求成功: %+v\n", response)
}

func CreateReturnOrder(config *wxpay_utility.MchConfig, request *CreateReturnOrderRequest) (response *ReturnOrdersEntity, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/v3/profitsharing/return-orders"
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
		response := &ReturnOrdersEntity{}
		if err := json.Unmarshal(respBody, response); err != nil {
			return nil, err
		}
		return response, nil
	} else {
		return nil, wxpay_utility.NewApiException(httpResponse.StatusCode, httpResponse.Header, respBody)
	}
}

type CreateReturnOrderRequest struct {
	SubMchid    *string `json:"sub_mchid,omitempty"`
	OrderId     *string `json:"order_id,omitempty"`
	OutOrderNo  *string `json:"out_order_no,omitempty"`
	OutReturnNo *string `json:"out_return_no,omitempty"`
	ReturnMchid *string `json:"return_mchid,omitempty"`
	Amount      *int64  `json:"amount,omitempty"`
	Description *string `json:"description,omitempty"`
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
