package main

import (
	"bytes"
	"demo/wxpay_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/v3/merchant/4015119334
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

	request := &CreateOrderRequest{
		Appid:         wxpay_utility.String("wx8888888888888888"),
		TransactionId: wxpay_utility.String("4208450740201411110007820472"),
		OutOrderNo:    wxpay_utility.String("P20150806125346"),
		Receivers: []CreateOrderReceiver{CreateOrderReceiver{
			Type:        wxpay_utility.String("MERCHANT_ID"),
			Account:     wxpay_utility.String("86693852"),
			Name:        wxpay_utility.String("hu89ohu89ohu89o"), /*请传入wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
			Amount:      wxpay_utility.Int64(888),
			Description: wxpay_utility.String("分给商户A"),
		}},
		UnfreezeUnsplit: wxpay_utility.Bool(true),
	}

	response, err := CreateOrder(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		return
	}

	fmt.Printf("请求成功: %+v\n", response)
}

func CreateOrder(config *wxpay_utility.MchConfig, request *CreateOrderRequest) (response *OrdersEntity, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/v3/profitsharing/orders"
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
		response := &OrdersEntity{}
		if err := json.Unmarshal(respBody, response); err != nil {
			return nil, err
		}
		return response, nil
	} else {
		return nil, wxpay_utility.NewApiException(httpResponse.StatusCode, httpResponse.Header, respBody)
	}
}

type CreateOrderRequest struct {
	Appid           *string               `json:"appid,omitempty"`
	TransactionId   *string               `json:"transaction_id,omitempty"`
	OutOrderNo      *string               `json:"out_order_no,omitempty"`
	Receivers       []CreateOrderReceiver `json:"receivers,omitempty"`
	UnfreezeUnsplit *bool                 `json:"unfreeze_unsplit,omitempty"`
}

type OrdersEntity struct {
	TransactionId *string               `json:"transaction_id,omitempty"`
	OutOrderNo    *string               `json:"out_order_no,omitempty"`
	OrderId       *string               `json:"order_id,omitempty"`
	State         *OrderStatus          `json:"state,omitempty"`
	Receivers     []OrderReceiverDetail `json:"receivers,omitempty"`
}

type CreateOrderReceiver struct {
	Type        *string `json:"type,omitempty"`
	Account     *string `json:"account,omitempty"`
	Name        *string `json:"name,omitempty"`
	Amount      *int64  `json:"amount,omitempty"`
	Description *string `json:"description,omitempty"`
}

type OrderStatus string

func (e OrderStatus) Ptr() *OrderStatus { return &e }

const (
	ORDERSTATUS_PROCESSING OrderStatus = "PROCESSING"
	ORDERSTATUS_FINISHED   OrderStatus = "FINISHED"
)

type OrderReceiverDetail struct {
	Amount      *int64            `json:"amount,omitempty"`
	Description *string           `json:"description,omitempty"`
	Type        *ReceiverType     `json:"type,omitempty"`
	Account     *string           `json:"account,omitempty"`
	Result      *DetailStatus     `json:"result,omitempty"`
	FailReason  *DetailFailReason `json:"fail_reason,omitempty"`
	CreateTime  *time.Time        `json:"create_time,omitempty"`
	FinishTime  *time.Time        `json:"finish_time,omitempty"`
	DetailId    *string           `json:"detail_id,omitempty"`
}

type ReceiverType string

func (e ReceiverType) Ptr() *ReceiverType { return &e }

const (
	RECEIVERTYPE_MERCHANT_ID     ReceiverType = "MERCHANT_ID"
	RECEIVERTYPE_PERSONAL_OPENID ReceiverType = "PERSONAL_OPENID"
)

type DetailStatus string

func (e DetailStatus) Ptr() *DetailStatus { return &e }

const (
	DETAILSTATUS_PENDING DetailStatus = "PENDING"
	DETAILSTATUS_SUCCESS DetailStatus = "SUCCESS"
	DETAILSTATUS_CLOSED  DetailStatus = "CLOSED"
)

type DetailFailReason string

func (e DetailFailReason) Ptr() *DetailFailReason { return &e }

const (
	DETAILFAILREASON_ACCOUNT_ABNORMAL                DetailFailReason = "ACCOUNT_ABNORMAL"
	DETAILFAILREASON_NO_RELATION                     DetailFailReason = "NO_RELATION"
	DETAILFAILREASON_RECEIVER_HIGH_RISK              DetailFailReason = "RECEIVER_HIGH_RISK"
	DETAILFAILREASON_RECEIVER_REAL_NAME_NOT_VERIFIED DetailFailReason = "RECEIVER_REAL_NAME_NOT_VERIFIED"
	DETAILFAILREASON_NO_AUTH                         DetailFailReason = "NO_AUTH"
	DETAILFAILREASON_RECEIVER_RECEIPT_LIMIT          DetailFailReason = "RECEIVER_RECEIPT_LIMIT"
	DETAILFAILREASON_PAYER_ACCOUNT_ABNORMAL          DetailFailReason = "PAYER_ACCOUNT_ABNORMAL"
	DETAILFAILREASON_INVALID_REQUEST                 DetailFailReason = "INVALID_REQUEST"
)
