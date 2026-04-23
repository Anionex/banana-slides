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

	request := &PartnerApiv3CommonPrepayRequest{
		SpAppid:     wxpay_utility.String("wx8888888888888888"),
		SpMchid:     wxpay_utility.String("1230000109"),
		SubAppid:    wxpay_utility.String("wxd678efh567hg6999"),
		SubMchid:    wxpay_utility.String("1900000109"),
		Description: wxpay_utility.String("Image形象店-深圳腾大-QQ公仔"),
		OutTradeNo:  wxpay_utility.String("1217752501201407033233368018"),
		TimeExpire:  wxpay_utility.Time(time.Now()),
		Attach:      wxpay_utility.String("自定义数据说明"),
		NotifyUrl:   wxpay_utility.String(" https://www.weixin.qq.com/wxpay/pay.php"),
		GoodsTag:    wxpay_utility.String("WXG"),
		SettleInfo: &PartnerSettleInfo{
			ProfitSharing: wxpay_utility.Bool(true),
		},
		SupportFapiao: wxpay_utility.Bool(false),
		Amount: &CommonAmountInfo{
			Total:    wxpay_utility.Int64(100),
			Currency: wxpay_utility.String("CNY"),
		},
		Detail: &CouponInfo{
			CostPrice: wxpay_utility.Int64(608800),
			InvoiceId: wxpay_utility.String("微信123"),
			GoodsDetail: []GoodsDetail{
				GoodsDetail{
					MerchantGoodsId:  wxpay_utility.String("1246464644"),
					WechatpayGoodsId: wxpay_utility.String("1001"),
					GoodsName:        wxpay_utility.String("iPhoneX 256G"),
					Quantity:         wxpay_utility.Int64(1),
					UnitPrice:        wxpay_utility.Int64(528800),
				},
			},
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
	}

	response, err := PartnerAppPrepay(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		return
	}

	fmt.Printf("请求成功: %+v\n", response)
}

func PartnerAppPrepay(config *wxpay_utility.MchConfig, request *PartnerApiv3CommonPrepayRequest) (response *PartnerApiv3AppPrepayResponse, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/v3/pay/partner/transactions/app"
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
		err = wxpay_utility.ValidateResponse(
			config.WechatPayPublicKeyId(),
			config.WechatPayPublicKey(),
			&httpResponse.Header,
			respBody,
		)
		if err != nil {
			return nil, err
		}
		response := &PartnerApiv3AppPrepayResponse{}
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

type PartnerApiv3CommonPrepayRequest struct {
	SpAppid       *string            `json:"sp_appid,omitempty"`
	SpMchid       *string            `json:"sp_mchid,omitempty"`
	SubAppid      *string            `json:"sub_appid,omitempty"`
	SubMchid      *string            `json:"sub_mchid,omitempty"`
	Description   *string            `json:"description,omitempty"`
	OutTradeNo    *string            `json:"out_trade_no,omitempty"`
	TimeExpire    *time.Time         `json:"time_expire,omitempty"`
	Attach        *string            `json:"attach,omitempty"`
	NotifyUrl     *string            `json:"notify_url,omitempty"`
	GoodsTag      *string            `json:"goods_tag,omitempty"`
	SettleInfo    *PartnerSettleInfo `json:"settle_info,omitempty"`
	SupportFapiao *bool              `json:"support_fapiao,omitempty"`
	Amount        *CommonAmountInfo  `json:"amount,omitempty"`
	Detail        *CouponInfo        `json:"detail,omitempty"`
	SceneInfo     *CommonSceneInfo   `json:"scene_info,omitempty"`
}

type PartnerApiv3AppPrepayResponse struct {
	PrepayId *string `json:"prepay_id,omitempty"`
}

type PartnerSettleInfo struct {
	ProfitSharing *bool `json:"profit_sharing,omitempty"`
}

type CommonAmountInfo struct {
	Total    *int64  `json:"total,omitempty"`
	Currency *string `json:"currency,omitempty"`
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
