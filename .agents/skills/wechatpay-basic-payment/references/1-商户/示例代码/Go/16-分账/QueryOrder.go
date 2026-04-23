package main

import (
	"demo/wxpay_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/v3/merchant/4015119334
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
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

	request := &QueryOrderRequest{
		TransactionId: wxpay_utility.String("4208450740201411110007820472"),
		OutOrderNo:    wxpay_utility.String("P20150806125346"),
	}

	response, err := QueryOrder(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}

func QueryOrder(config *wxpay_utility.MchConfig, request *QueryOrderRequest) (response *OrdersEntity, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "GET"
		path   = "/v3/profitsharing/orders/{out_order_no}"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	reqUrl.Path = strings.Replace(reqUrl.Path, "{out_order_no}", url.PathEscape(*request.OutOrderNo), -1)
	query := reqUrl.Query()
	if request.TransactionId != nil {
		query.Add("transaction_id", *request.TransactionId)
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
		response := &OrdersEntity{}
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

type QueryOrderRequest struct {
	TransactionId *string `json:"transaction_id,omitempty"`
	OutOrderNo    *string `json:"out_order_no,omitempty"`
}

func (o *QueryOrderRequest) MarshalJSON() ([]byte, error) {
	type Alias QueryOrderRequest
	a := &struct {
		TransactionId *string `json:"transaction_id,omitempty"`
		OutOrderNo    *string `json:"out_order_no,omitempty"`
		*Alias
	}{
		// 序列化时移除非 Body 字段
		TransactionId: nil,
		OutOrderNo:    nil,
		Alias:         (*Alias)(o),
	}
	return json.Marshal(a)
}

type OrdersEntity struct {
	TransactionId *string               `json:"transaction_id,omitempty"`
	OutOrderNo    *string               `json:"out_order_no,omitempty"`
	OrderId       *string               `json:"order_id,omitempty"`
	State         *OrderStatus          `json:"state,omitempty"`
	Receivers     []OrderReceiverDetail `json:"receivers,omitempty"`
}

type OrderStatus string

func (e OrderStatus) Ptr() *OrderStatus {
	return &e
}

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

func (e ReceiverType) Ptr() *ReceiverType {
	return &e
}

const (
	RECEIVERTYPE_MERCHANT_ID     ReceiverType = "MERCHANT_ID"
	RECEIVERTYPE_PERSONAL_OPENID ReceiverType = "PERSONAL_OPENID"
)

type DetailStatus string

func (e DetailStatus) Ptr() *DetailStatus {
	return &e
}

const (
	DETAILSTATUS_PENDING DetailStatus = "PENDING"
	DETAILSTATUS_SUCCESS DetailStatus = "SUCCESS"
	DETAILSTATUS_CLOSED  DetailStatus = "CLOSED"
)

type DetailFailReason string

func (e DetailFailReason) Ptr() *DetailFailReason {
	return &e
}

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

请求分账回退
