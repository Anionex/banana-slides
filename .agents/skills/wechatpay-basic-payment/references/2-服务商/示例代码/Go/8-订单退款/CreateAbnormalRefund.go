package main

import (
	"bytes"
	"demo/wxpay_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/v3/partner/4015119446
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
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

	request := &CreateAbnormalRefundRequest{
		RefundId:    wxpay_utility.String("50000000382019052709732678859"),
		SubMchid:    wxpay_utility.String("1900000109"),
		OutRefundNo: wxpay_utility.String("1217752501201407033233368018"),
		Type:        ABNORMALRECEIVETYPE_MERCHANT_BANK_CARD.Ptr(),
		BankType:    wxpay_utility.String("ICBC_DEBIT"),
		BankAccount: wxpay_utility.String("d+xT+MQCvrLHUVDWv/8MR/dB7TkXLVfSrUxMPZy6jWWYzpRrEEaYQE8ZRGYoeorwC+w=="), /*请传入wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
		RealName:    wxpay_utility.String("UPgQcZSdq3zOayJwZ5XLrHY2dZU1W2Cd"),                                      /*请传入wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
	}

	response, err := CreateAbnormalRefund(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}

func CreateAbnormalRefund(config *wxpay_utility.MchConfig, request *CreateAbnormalRefundRequest) (response *Refund, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/v3/refund/domestic/refunds/{refund_id}/apply-abnormal-refund"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	reqUrl.Path = strings.Replace(reqUrl.Path, "{refund_id}", url.PathEscape(*request.RefundId), -1)
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
		response := &Refund{}
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

type CreateAbnormalRefundRequest struct {
	RefundId    *string              `json:"refund_id,omitempty"`
	SubMchid    *string              `json:"sub_mchid,omitempty"`
	OutRefundNo *string              `json:"out_refund_no,omitempty"`
	Type        *AbnormalReceiveType `json:"type,omitempty"`
	BankType    *string              `json:"bank_type,omitempty"`
	BankAccount *string              `json:"bank_account,omitempty"`
	RealName    *string              `json:"real_name,omitempty"`
}

func (o *CreateAbnormalRefundRequest) MarshalJSON() ([]byte, error) {
	type Alias CreateAbnormalRefundRequest
	a := &struct {
		RefundId *string `json:"refund_id,omitempty"`
		*Alias
	}{
		RefundId: nil,
		Alias:    (*Alias)(o),
	}
	return json.Marshal(a)
}

type Refund struct {
	RefundId            *string        `json:"refund_id,omitempty"`
	OutRefundNo         *string        `json:"out_refund_no,omitempty"`
	TransactionId       *string        `json:"transaction_id,omitempty"`
	OutTradeNo          *string        `json:"out_trade_no,omitempty"`
	Channel             *Channel       `json:"channel,omitempty"`
	UserReceivedAccount *string        `json:"user_received_account,omitempty"`
	SuccessTime         *time.Time     `json:"success_time,omitempty"`
	CreateTime          *time.Time     `json:"create_time,omitempty"`
	Status              *Status        `json:"status,omitempty"`
	FundsAccount        *FundsAccount  `json:"funds_account,omitempty"`
	Amount              *Amount        `json:"amount,omitempty"`
	PromotionDetail     []Promotion    `json:"promotion_detail,omitempty"`
	RefundAccount       *RefundAccount `json:"refund_account,omitempty"`
}

type AbnormalReceiveType string

func (e AbnormalReceiveType) Ptr() *AbnormalReceiveType {
	return &e
}

const (
	ABNORMALRECEIVETYPE_USER_BANK_CARD     AbnormalReceiveType = "USER_BANK_CARD"
	ABNORMALRECEIVETYPE_MERCHANT_BANK_CARD AbnormalReceiveType = "MERCHANT_BANK_CARD"
)

type Channel string

func (e Channel) Ptr() *Channel {
	return &e
}

const (
	CHANNEL_ORIGINAL       Channel = "ORIGINAL"
	CHANNEL_BALANCE        Channel = "BALANCE"
	CHANNEL_OTHER_BALANCE  Channel = "OTHER_BALANCE"
	CHANNEL_OTHER_BANKCARD Channel = "OTHER_BANKCARD"
)

type Status string

func (e Status) Ptr() *Status {
	return &e
}

const (
	STATUS_SUCCESS    Status = "SUCCESS"
	STATUS_CLOSED     Status = "CLOSED"
	STATUS_PROCESSING Status = "PROCESSING"
	STATUS_ABNORMAL   Status = "ABNORMAL"
)

type FundsAccount string

func (e FundsAccount) Ptr() *FundsAccount {
	return &e
}

const (
	FUNDSACCOUNT_UNSETTLED   FundsAccount = "UNSETTLED"
	FUNDSACCOUNT_AVAILABLE   FundsAccount = "AVAILABLE"
	FUNDSACCOUNT_UNAVAILABLE FundsAccount = "UNAVAILABLE"
	FUNDSACCOUNT_OPERATION   FundsAccount = "OPERATION"
	FUNDSACCOUNT_BASIC       FundsAccount = "BASIC"
	FUNDSACCOUNT_ECNY_BASIC  FundsAccount = "ECNY_BASIC"
)

type Amount struct {
	Total            *int64          `json:"total,omitempty"`
	Refund           *int64          `json:"refund,omitempty"`
	From             []FundsFromItem `json:"from,omitempty"`
	PayerTotal       *int64          `json:"payer_total,omitempty"`
	PayerRefund      *int64          `json:"payer_refund,omitempty"`
	SettlementRefund *int64          `json:"settlement_refund,omitempty"`
	SettlementTotal  *int64          `json:"settlement_total,omitempty"`
	DiscountRefund   *int64          `json:"discount_refund,omitempty"`
	Currency         *string         `json:"currency,omitempty"`
	RefundFee        *int64          `json:"refund_fee,omitempty"`
	Advance          *int64          `json:"advance,omitempty"`
}

type Promotion struct {
	PromotionId  *string         `json:"promotion_id,omitempty"`
	Scope        *PromotionScope `json:"scope,omitempty"`
	Type         *PromotionType  `json:"type,omitempty"`
	Amount       *int64          `json:"amount,omitempty"`
	RefundAmount *int64          `json:"refund_amount,omitempty"`
	GoodsDetail  []GoodsDetail   `json:"goods_detail,omitempty"`
}

type RefundAccount string

func (e RefundAccount) Ptr() *RefundAccount {
	return &e
}

const (
	REFUNDACCOUNT_REFUND_SOURCE_PARTNER_ADVANCE      RefundAccount = "REFUND_SOURCE_PARTNER_ADVANCE"
	REFUNDACCOUNT_REFUND_SOURCE_SUB_MERCHANT         RefundAccount = "REFUND_SOURCE_SUB_MERCHANT"
	REFUNDACCOUNT_REFUND_SOURCE_SUB_MERCHANT_ADVANCE RefundAccount = "REFUND_SOURCE_SUB_MERCHANT_ADVANCE"
)

type FundsFromItem struct {
	Account *Account `json:"account,omitempty"`
	Amount  *int64   `json:"amount,omitempty"`
}

type PromotionScope string

func (e PromotionScope) Ptr() *PromotionScope {
	return &e
}

const (
	PROMOTIONSCOPE_GLOBAL PromotionScope = "GLOBAL"
	PROMOTIONSCOPE_SINGLE PromotionScope = "SINGLE"
)

type PromotionType string

func (e PromotionType) Ptr() *PromotionType {
	return &e
}

const (
	PROMOTIONTYPE_COUPON   PromotionType = "COUPON"
	PROMOTIONTYPE_DISCOUNT PromotionType = "DISCOUNT"
)

type GoodsDetail struct {
	MerchantGoodsId  *string `json:"merchant_goods_id,omitempty"`
	WechatpayGoodsId *string `json:"wechatpay_goods_id,omitempty"`
	GoodsName        *string `json:"goods_name,omitempty"`
	UnitPrice        *int64  `json:"unit_price,omitempty"`
	RefundAmount     *int64  `json:"refund_amount,omitempty"`
	RefundQuantity   *int64  `json:"refund_quantity,omitempty"`
}

type Account string

func (e Account) Ptr() *Account {
	return &e
}

const (
	ACCOUNT_AVAILABLE   Account = "AVAILABLE"
	ACCOUNT_UNAVAILABLE Account = "UNAVAILABLE"
)
