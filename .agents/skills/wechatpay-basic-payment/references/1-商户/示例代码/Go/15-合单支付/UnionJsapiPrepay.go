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

	request := &UnionApiv3JsapiPrepayRequest{
		CombineAppid:      wxpay_utility.String("wxd678efh567hg6787"),
		CombineMchid:      wxpay_utility.String("1230000109"),
		CombineOutTradeNo: wxpay_utility.String("1217752501201407033233368018"),
		CombinePayerInfo: &UnionPayerInfo{
			Openid: wxpay_utility.String("oUpF8uMuAJO_M2pxb1Q9zNjWeS6o"),
		},
		SceneInfo: &UnionSceneInfo{
			DeviceId:      wxpay_utility.String("POS1:1"),
			PayerClientIp: wxpay_utility.String("14.17.22.32"),
		},
		SubOrders: []UnionSubOrder{
			UnionSubOrder{
				Mchid:      wxpay_utility.String("1230000109"),
				OutTradeNo: wxpay_utility.String("20150806125346"),
				Amount: &UnionAmountInfo{
					TotalAmount: wxpay_utility.Int64(10),
					Currency:    wxpay_utility.String("CNY"),
				},
				Attach:      wxpay_utility.String("深圳分店"),
				Description: wxpay_utility.String("腾讯充值中心-QQ会员充值"),
				Detail:      wxpay_utility.String("买单费用"),
				GoodsTag:    wxpay_utility.String("WXG"),
				SettleInfo: &UnionSettleInfo{
					ProfitSharing: wxpay_utility.Bool(false),
				},
			},
			UnionSubOrder{
				Mchid:      wxpay_utility.String("1230000119"),
				OutTradeNo: wxpay_utility.String("20150806125347"),
				Amount: &UnionAmountInfo{
					TotalAmount: wxpay_utility.Int64(10),
					Currency:    wxpay_utility.String("CNY"),
				},
				Attach:      wxpay_utility.String("广州分店"),
				Description: wxpay_utility.String("腾讯充值中心-微信充值"),
				Detail:      wxpay_utility.String("买单费用"),
				GoodsTag:    wxpay_utility.String("WXG"),
				SettleInfo: &UnionSettleInfo{
					ProfitSharing: wxpay_utility.Bool(false),
				},
			},
		},
		TimeExpire: wxpay_utility.Time(time.Now()),
		NotifyUrl:  wxpay_utility.String("https://yourapp.com/notify"),
	}

	response, err := UnionJsapiPrepay(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}

func UnionJsapiPrepay(config *wxpay_utility.MchConfig, request *UnionApiv3JsapiPrepayRequest) (response *UnionApiv3JsapiPrepayResponse, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/v3/combine-transactions/jsapi"
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
		response := &UnionApiv3JsapiPrepayResponse{}
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

type UnionApiv3JsapiPrepayRequest struct {
	CombineAppid      *string         `json:"combine_appid,omitempty"`
	CombineMchid      *string         `json:"combine_mchid,omitempty"`
	CombineOutTradeNo *string         `json:"combine_out_trade_no,omitempty"`
	CombinePayerInfo  *UnionPayerInfo `json:"combine_payer_info,omitempty"`
	SceneInfo         *UnionSceneInfo `json:"scene_info,omitempty"`
	SubOrders         []UnionSubOrder `json:"sub_orders,omitempty"`
	TimeExpire        *time.Time      `json:"time_expire,omitempty"`
	NotifyUrl         *string         `json:"notify_url,omitempty"`
}

type UnionApiv3JsapiPrepayResponse struct {
	PrepayId *string `json:"prepay_id,omitempty"`
}

type UnionPayerInfo struct {
	Openid    *string `json:"openid,omitempty"`
	SubOpenid *string `json:"sub_openid,omitempty"`
}

type UnionSceneInfo struct {
	DeviceId      *string `json:"device_id,omitempty"`
	PayerClientIp *string `json:"payer_client_ip,omitempty"`
}

type UnionSubOrder struct {
	Mchid       *string          `json:"mchid,omitempty"`
	OutTradeNo  *string          `json:"out_trade_no,omitempty"`
	Amount      *UnionAmountInfo `json:"amount,omitempty"`
	Attach      *string          `json:"attach,omitempty"`
	Description *string          `json:"description,omitempty"`
	Detail      *string          `json:"detail,omitempty"`
	GoodsTag    *string          `json:"goods_tag,omitempty"`
	SettleInfo  *UnionSettleInfo `json:"settle_info,omitempty"`
}

type UnionAmountInfo struct {
	TotalAmount *int64  `json:"total_amount,omitempty"`
	Currency    *string `json:"currency,omitempty"`
}

type UnionSettleInfo struct {
	ProfitSharing *bool `json:"profit_sharing,omitempty"`
}
