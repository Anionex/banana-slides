package main

import (
	"demo/wxpay_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/v3/merchant/4015119334
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
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

	request := &QueryByWxTradeNoRequest{
		Mchid:         wxpay_utility.String("1230000109"),
		TransactionId: wxpay_utility.String("1217752501201407033233368018"),
	}

	response, err := QueryByWxTradeNo(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}

func QueryByWxTradeNo(config *wxpay_utility.MchConfig, request *QueryByWxTradeNoRequest) (response *DirectApiv3QueryResponse, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "GET"
		path   = "/v3/pay/transactions/id/{transaction_id}"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	reqUrl.Path = strings.Replace(reqUrl.Path, "{transaction_id}", url.PathEscape(*request.TransactionId), -1)
	query := reqUrl.Query()
	if request.Mchid != nil {
		query.Add("mchid", *request.Mchid)
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
		response := &DirectApiv3QueryResponse{}
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

type QueryByWxTradeNoRequest struct {
	Mchid         *string `json:"mchid,omitempty"`
	TransactionId *string `json:"transaction_id,omitempty"`
}

func (o *QueryByWxTradeNoRequest) MarshalJSON() ([]byte, error) {
	type Alias QueryByWxTradeNoRequest
	a := &struct {
		Mchid         *string `json:"mchid,omitempty"`
		TransactionId *string `json:"transaction_id,omitempty"`
		*Alias
	}{
		// 序列化时移除非 Body 字段
		Mchid:         nil,
		TransactionId: nil,
		Alias:         (*Alias)(o),
	}
	return json.Marshal(a)
}

type DirectApiv3QueryResponse struct {
	Appid           *string             `json:"appid,omitempty"`
	Mchid           *string             `json:"mchid,omitempty"`
	OutTradeNo      *string             `json:"out_trade_no,omitempty"`
	TransactionId   *string             `json:"transaction_id,omitempty"`
	TradeType       *string             `json:"trade_type,omitempty"`
	TradeState      *string             `json:"trade_state,omitempty"`
	TradeStateDesc  *string             `json:"trade_state_desc,omitempty"`
	BankType        *string             `json:"bank_type,omitempty"`
	Attach          *string             `json:"attach,omitempty"`
	SuccessTime     *string             `json:"success_time,omitempty"`
	Payer           *CommRespPayerInfo  `json:"payer,omitempty"`
	Amount          *CommRespAmountInfo `json:"amount,omitempty"`
	SceneInfo       *CommRespSceneInfo  `json:"scene_info,omitempty"`
	PromotionDetail []PromotionDetail   `json:"promotion_detail,omitempty"`
}

type CommRespPayerInfo struct {
	Openid *string `json:"openid,omitempty"`
}

type CommRespAmountInfo struct {
	Total         *int64  `json:"total,omitempty"`
	PayerTotal    *int64  `json:"payer_total,omitempty"`
	Currency      *string `json:"currency,omitempty"`
	PayerCurrency *string `json:"payer_currency,omitempty"`
}

type CommRespSceneInfo struct {
	DeviceId *string `json:"device_id,omitempty"`
}

type PromotionDetail struct {
	CouponId            *string                  `json:"coupon_id,omitempty"`
	Name                *string                  `json:"name,omitempty"`
	Scope               *string                  `json:"scope,omitempty"`
	Type                *string                  `json:"type,omitempty"`
	Amount              *int64                   `json:"amount,omitempty"`
	StockId             *string                  `json:"stock_id,omitempty"`
	WechatpayContribute *int64                   `json:"wechatpay_contribute,omitempty"`
	MerchantContribute  *int64                   `json:"merchant_contribute,omitempty"`
	OtherContribute     *int64                   `json:"other_contribute,omitempty"`
	Currency            *string                  `json:"currency,omitempty"`
	GoodsDetail         []GoodsDetailInPromotion `json:"goods_detail,omitempty"`
}

type GoodsDetailInPromotion struct {
	GoodsId        *string `json:"goods_id,omitempty"`
	Quantity       *int64  `json:"quantity,omitempty"`
	UnitPrice      *int64  `json:"unit_price,omitempty"`
	DiscountAmount *int64  `json:"discount_amount,omitempty"`
	GoodsRemark    *string `json:"goods_remark,omitempty"`
}
