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

	request := &DirectApiv3JsapiPrepayRequest{
		Appid:         wxpay_utility.String("wxd678efh567hg6787"),
		Mchid:         wxpay_utility.String("1230000109"),
		Description:   wxpay_utility.String("Image形象店-深圳腾大-QQ公仔"),
		OutTradeNo:    wxpay_utility.String("1217752501201407033233368018"),
		TimeExpire:    wxpay_utility.Time(time.Now()),
		Attach:        wxpay_utility.String("自定义数据说明"),
		NotifyUrl:     wxpay_utility.String(" https://www.weixin.qq.com/wxpay/pay.php"),
		GoodsTag:      wxpay_utility.String("WXG"),
		SupportFapiao: wxpay_utility.Bool(false),
		Amount: &CommonAmountInfo{
			Total:    wxpay_utility.Int64(100),
			Currency: wxpay_utility.String("CNY"),
		},
		Payer: &JsapiReqPayerInfo{
			Openid: wxpay_utility.String("oUpF8uMuAJO_M2pxb1Q9zNjWeS6o"),
		},
		Detail: &CouponInfo{
			CostPrice: wxpay_utility.Int64(608800),
			InvoiceId: wxpay_utility.String("微信123"),
			GoodsDetail: []GoodsDetail{GoodsDetail{
				MerchantGoodsId:  wxpay_utility.String("1246464644"),
				WechatpayGoodsId: wxpay_utility.String("1001"),
				GoodsName:        wxpay_utility.String("iPhoneX 256G"),
				Quantity:         wxpay_utility.Int64(1),
				UnitPrice:        wxpay_utility.Int64(528800),
			}},
		},
		SceneInfo: &CommonSceneInfo{
			PayerClientIp: wxpay_utility.String("14.23.150.211"),
			DeviceId:      wxpay_utility.String("013467007045764"),
			StoreInfo: &StoreInfo{
				Id:       wxpay_utility.String("0001"),
				Name:     wxpay_utility.String("腾讯大厦分店"),
				AreaCode: wxpay_utility.String("440305"),
				Address:  wxpay_utility.String("广东省深圳市南山区科技中一道10000号"),
			},
		},
		SettleInfo: &SettleInfo{
			ProfitSharing: wxpay_utility.Bool(false),
		},
	}

	response, err := JsapiPrepay(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}

func JsapiPrepay(config *wxpay_utility.MchConfig, request *DirectApiv3JsapiPrepayRequest) (response *DirectApiv3JsapiPrepayResponse, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/v3/pay/transactions/jsapi"
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
		response := &DirectApiv3JsapiPrepayResponse{}
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

type DirectApiv3JsapiPrepayRequest struct {
	Appid         *string            `json:"appid,omitempty"`
	Mchid         *string            `json:"mchid,omitempty"`
	Description   *string            `json:"description,omitempty"`
	OutTradeNo    *string            `json:"out_trade_no,omitempty"`
	TimeExpire    *time.Time         `json:"time_expire,omitempty"`
	Attach        *string            `json:"attach,omitempty"`
	NotifyUrl     *string            `json:"notify_url,omitempty"`
	GoodsTag      *string            `json:"goods_tag,omitempty"`
	SupportFapiao *bool              `json:"support_fapiao,omitempty"`
	Amount        *CommonAmountInfo  `json:"amount,omitempty"`
	Payer         *JsapiReqPayerInfo `json:"payer,omitempty"`
	Detail        *CouponInfo        `json:"detail,omitempty"`
	SceneInfo     *CommonSceneInfo   `json:"scene_info,omitempty"`
	SettleInfo    *SettleInfo        `json:"settle_info,omitempty"`
}

type DirectApiv3JsapiPrepayResponse struct {
	PrepayId *string `json:"prepay_id,omitempty"`
}

type CommonAmountInfo struct {
	Total    *int64  `json:"total,omitempty"`
	Currency *string `json:"currency,omitempty"`
}

type JsapiReqPayerInfo struct {
	Openid *string `json:"openid,omitempty"`
}

type CouponInfo struct {
	CostPrice   *int64        `json:"cost_price,omitempty"`
	InvoiceId   *string       `json:"invoice_id,omitempty"`
	GoodsDetail []GoodsDetail `json:"goods_detail,omitempty"`
}

type CommonSceneInfo struct {
	PayerClientIp *string    `json:"payer_client_ip,omitempty"`
	DeviceId      *string    `json:"device_id,omitempty"`
	StoreInfo     *StoreInfo `json:"store_info,omitempty"`
}

type SettleInfo struct {
	ProfitSharing *bool `json:"profit_sharing,omitempty"`
}

type GoodsDetail struct {
	MerchantGoodsId  *string `json:"merchant_goods_id,omitempty"`
	WechatpayGoodsId *string `json:"wechatpay_goods_id,omitempty"`
	GoodsName        *string `json:"goods_name,omitempty"`
	Quantity         *int64  `json:"quantity,omitempty"`
	UnitPrice        *int64  `json:"unit_price,omitempty"`
}

type StoreInfo struct {
	Id       *string `json:"id,omitempty"`
	Name     *string `json:"name,omitempty"`
	AreaCode *string `json:"area_code,omitempty"`
	Address  *string `json:"address,omitempty"`
}
