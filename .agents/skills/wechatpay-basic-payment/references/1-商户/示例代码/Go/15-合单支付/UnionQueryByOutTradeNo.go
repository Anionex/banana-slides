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

	request := &UnionQueryByOutTradeNoRequest{
		CombineOutTradeNo: wxpay_utility.String("P20150806125346"),
	}

	response, err := UnionQueryByOutTradeNo(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}

func UnionQueryByOutTradeNo(config *wxpay_utility.MchConfig, request *UnionQueryByOutTradeNoRequest) (response *UnionApiv3UnionQueryResponse, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "GET"
		path   = "/v3/combine-transactions/out-trade-no/{combine_out_trade_no}"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	reqUrl.Path = strings.Replace(reqUrl.Path, "{combine_out_trade_no}", url.PathEscape(*request.CombineOutTradeNo), -1)
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
		response := &UnionApiv3UnionQueryResponse{}
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

type UnionQueryByOutTradeNoRequest struct {
	CombineOutTradeNo *string `json:"combine_out_trade_no,omitempty"`
}

func (o *UnionQueryByOutTradeNoRequest) MarshalJSON() ([]byte, error) {
	type Alias UnionQueryByOutTradeNoRequest
	a := &struct {
		CombineOutTradeNo *string `json:"combine_out_trade_no,omitempty"`
		*Alias
	}{
		// 序列化时移除非 Body 字段
		CombineOutTradeNo: nil,
		Alias:             (*Alias)(o),
	}
	return json.Marshal(a)
}

type UnionApiv3UnionQueryResponse struct {
	CombineAppid      *string                 `json:"combine_appid,omitempty"`
	CombineMchid      *string                 `json:"combine_mchid,omitempty"`
	CombineOutTradeNo *string                 `json:"combine_out_trade_no,omitempty"`
	CombinePayerInfo  *UnionCommRespPayerInfo `json:"combine_payer_info,omitempty"`
	SceneInfo         *UnionCommRespSceneInfo `json:"scene_info,omitempty"`
	SubOrders         []UnionSubOrder         `json:"sub_orders,omitempty"`
}

type UnionCommRespPayerInfo struct {
	Openid *string `json:"openid,omitempty"`
}

type UnionCommRespSceneInfo struct {
	DeviceId *string `json:"device_id,omitempty"`
}

type UnionSubOrder struct {
	Mchid           *string                  `json:"mchid,omitempty"`
	SubMchid        *string                  `json:"sub_mchid,omitempty"`
	SubAppid        *string                  `json:"sub_appid,omitempty"`
	SubOpenid       *string                  `json:"sub_openid,omitempty"`
	OutTradeNo      *string                  `json:"out_trade_no,omitempty"`
	TransactionId   *string                  `json:"transaction_id,omitempty"`
	TradeType       *string                  `json:"trade_type,omitempty"`
	TradeState      *string                  `json:"trade_state,omitempty"`
	BankType        *string                  `json:"bank_type,omitempty"`
	Attach          *string                  `json:"attach,omitempty"`
	SuccessTime     *string                  `json:"success_time,omitempty"`
	Amount          *UnionCommRespAmountInfo `json:"amount,omitempty"`
	PromotionDetail []UnionPromotionDetail   `json:"promotion_detail,omitempty"`
}

type UnionCommRespAmountInfo struct {
	TotalAmount    *int64  `json:"total_amount,omitempty"`
	PayerAmount    *int64  `json:"payer_amount,omitempty"`
	Currency       *string `json:"currency,omitempty"`
	PayerCurrency  *string `json:"payer_currency,omitempty"`
	SettlementRate *int64  `json:"settlement_rate,omitempty"`
}

type UnionPromotionDetail struct {
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
