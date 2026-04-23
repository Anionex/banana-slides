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

// 退款申请
//
// 支付成功后1年内，可通过此接口将款项全部或部分原路退还给用户（也可在商户平台手动操作）。
//
// 关键注意：
// 1. 一笔订单最多50次部分退款，重试必须用原 out_refund_no，否则会重复退款。
// 2. 接口返回成功仅表示受理成功，实际结果以退款回调通知或查询退款接口为准。
// 3. 原路退还：银行卡1-3个工作日到账，零钱即时到账。
// 4. 有代金券的订单部分退款时，退给用户 = 退款金额 × (实付 ÷ 总额)，四舍五入。
// 5. 有分账的订单，需确保可用余额充足；部分分账未解冻时需先调"完结分账"。
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

	request := &CreateRequest{
		TransactionId: wxpay_utility.String("1217752501201407033233368018"),
		OutTradeNo:    wxpay_utility.String("1217752501201407033233368018"),
		OutRefundNo:   wxpay_utility.String("1217752501201407033233368018"),
		Reason:        wxpay_utility.String("商品已售完"),
		NotifyUrl:     wxpay_utility.String("https://weixin.qq.com"),
		FundsAccount:  REQFUNDSACCOUNT_AVAILABLE.Ptr(),
		Amount: &AmountReq{
			Refund: wxpay_utility.Int64(888),
			From: []FundsFromItem{FundsFromItem{
				Account: ACCOUNT_AVAILABLE.Ptr(),
				Amount:  wxpay_utility.Int64(444),
			}},
			Total:    wxpay_utility.Int64(888),
			Currency: wxpay_utility.String("CNY"),
		},
		GoodsDetail: []GoodsDetail{GoodsDetail{
			MerchantGoodsId:  wxpay_utility.String("1217752501201407033233368018"),
			WechatpayGoodsId: wxpay_utility.String("1001"),
			GoodsName:        wxpay_utility.String("iPhone6s 16G"),
			UnitPrice:        wxpay_utility.Int64(528800),
			RefundAmount:     wxpay_utility.Int64(528800),
			RefundQuantity:   wxpay_utility.Int64(1),
		}},
	}

	response, err := CreateRefund(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}

// CreateRefund 退款申请
//
// 在交易完成后的一年内（以支付成功时间为起点+365天计算），若因用户或商户方面导致需进行订单退款，
// 商户可通过此接口将支付金额的全部或部分原路退还至用户。
//
// 注意：
// 1. 一笔订单最多支持50次部分退款（若需多次部分退款，请更换商户退款单号并间隔1分钟后再次调用）。
// 2. 在申请退款失败后进行重试时，请务必使用原商户退款单号，以避免因重复退款而导致的资金损失。
// 3. 同一商户号下，此接口调用成功的频率限制为150QPS，而调用失败报错时的频率限制为6QPS。
// 4. 申请退款接口返回成功仅表示退款单已受理成功，具体的退款结果需依据退款结果通知及查询退款的返回信息为准。
// 5. 若一个月前的订单申请退款时返回报错"频率限制，1个月之前的订单请降低申请频率再重试"，请调整退款时间，再使用原参数进行重试。
func CreateRefund(config *wxpay_utility.MchConfig, request *CreateRequest) (response *Refund, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/v3/refund/domestic/refunds"
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

type CreateRequest struct {
	TransactionId *string          `json:"transaction_id,omitempty"`
	OutTradeNo    *string          `json:"out_trade_no,omitempty"`
	OutRefundNo   *string          `json:"out_refund_no,omitempty"`
	Reason        *string          `json:"reason,omitempty"`
	NotifyUrl     *string          `json:"notify_url,omitempty"`
	FundsAccount  *ReqFundsAccount `json:"funds_account,omitempty"`
	Amount        *AmountReq       `json:"amount,omitempty"`
	GoodsDetail   []GoodsDetail    `json:"goods_detail,omitempty"`
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
}

type ReqFundsAccount string

func (e ReqFundsAccount) Ptr() *ReqFundsAccount {
	return &e
}

const (
	REQFUNDSACCOUNT_AVAILABLE ReqFundsAccount = "AVAILABLE"
	REQFUNDSACCOUNT_UNSETTLED ReqFundsAccount = "UNSETTLED"
)

type AmountReq struct {
	Refund   *int64          `json:"refund,omitempty"`
	From     []FundsFromItem `json:"from,omitempty"`
	Total    *int64          `json:"total,omitempty"`
	Currency *string         `json:"currency,omitempty"`
}

type GoodsDetail struct {
	MerchantGoodsId  *string `json:"merchant_goods_id,omitempty"`
	WechatpayGoodsId *string `json:"wechatpay_goods_id,omitempty"`
	GoodsName        *string `json:"goods_name,omitempty"`
	UnitPrice        *int64  `json:"unit_price,omitempty"`
	RefundAmount     *int64  `json:"refund_amount,omitempty"`
	RefundQuantity   *int64  `json:"refund_quantity,omitempty"`
}

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
}

type Promotion struct {
	PromotionId  *string         `json:"promotion_id,omitempty"`
	Scope        *PromotionScope `json:"scope,omitempty"`
	Type         *PromotionType  `json:"type,omitempty"`
	Amount       *int64          `json:"amount,omitempty"`
	RefundAmount *int64          `json:"refund_amount,omitempty"`
	GoodsDetail  []GoodsDetail   `json:"goods_detail,omitempty"`
}

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
	PROMOTIONTYPE_CASH   PromotionType = "CASH"
	PROMOTIONTYPE_NOCASH PromotionType = "NOCASH"
)

type Account string

func (e Account) Ptr() *Account {
	return &e
}

const (
	ACCOUNT_AVAILABLE   Account = "AVAILABLE"
	ACCOUNT_UNAVAILABLE Account = "UNAVAILABLE"
)
