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

	request := &UnionApiv3H5PrepayRequest{
		CombineAppid:      wxpay_utility.String("wxd678efh567hg6787"),
		CombineOutTradeNo: wxpay_utility.String("1217752501201407033233368018"),
		CombineMchid:      wxpay_utility.String("1230000109"),
		SceneInfo: &UnionH5SceneInfo{
			PayerClientIp: wxpay_utility.String("14.23.150.211"),
			DeviceId:      wxpay_utility.String("013467007045764"),
			H5Info: &UnionH5Info{
				Type:        wxpay_utility.String("iOS"),
				AppName:     wxpay_utility.String("王者荣耀"),
				AppUrl:      wxpay_utility.String("https://pay.qq.com"),
				BundleId:    wxpay_utility.String("com.tencent.wzryiOS"),
				PackageName: wxpay_utility.String("com.tencent.tmgp.sgame"),
			},
		},
		SubOrders: []UnionCommonSubOrder{
			UnionCommonSubOrder{
				Mchid:      wxpay_utility.String("1230000109"),
				OutTradeNo: wxpay_utility.String("20150806125346"),
				Amount: &UnionAmountInfo{
					TotalAmount: wxpay_utility.Int64(10),
					Currency:    wxpay_utility.String("CNY"),
				},
				Attach:      wxpay_utility.String("深圳分店"),
				Description: wxpay_utility.String("腾讯充值中心-QQ会员充值"),
				GoodsTag:    wxpay_utility.String("WXG"),
				SettleInfo: &UnionSettleInfo{
					ProfitSharing: wxpay_utility.Bool(false),
				},
			},
			UnionCommonSubOrder{
				Mchid:      wxpay_utility.String("1230000119"),
				OutTradeNo: wxpay_utility.String("20150806125347"),
				Amount: &UnionAmountInfo{
					TotalAmount: wxpay_utility.Int64(10),
					Currency:    wxpay_utility.String("CNY"),
				},
				Attach:      wxpay_utility.String("广州分店"),
				Description: wxpay_utility.String("腾讯充值中心-微信充值"),
				GoodsTag:    wxpay_utility.String("WXG"),
				SettleInfo: &UnionSettleInfo{
					ProfitSharing: wxpay_utility.Bool(false),
				},
			},
		},
		TimeExpire: wxpay_utility.Time(time.Now()),
		NotifyUrl:  wxpay_utility.String("https://yourapp.com/notify"),
	}

	response, err := UnionH5Prepay(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}

func UnionH5Prepay(config *wxpay_utility.MchConfig, request *UnionApiv3H5PrepayRequest) (response *UnionApiv3H5PrepayResponse, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/v3/combine-transactions/h5"
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
		response := &UnionApiv3H5PrepayResponse{}
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

type UnionApiv3H5PrepayRequest struct {
	CombineAppid      *string               `json:"combine_appid,omitempty"`
	CombineOutTradeNo *string               `json:"combine_out_trade_no,omitempty"`
	CombineMchid      *string               `json:"combine_mchid,omitempty"`
	SceneInfo         *UnionH5SceneInfo     `json:"scene_info,omitempty"`
	SubOrders         []UnionCommonSubOrder `json:"sub_orders,omitempty"`
	TimeExpire        *time.Time            `json:"time_expire,omitempty"`
	NotifyUrl         *string               `json:"notify_url,omitempty"`
}

type UnionApiv3H5PrepayResponse struct {
	H5Url *string `json:"h5_url,omitempty"`
}

type UnionH5SceneInfo struct {
	PayerClientIp *string      `json:"payer_client_ip,omitempty"`
	DeviceId      *string      `json:"device_id,omitempty"`
	H5Info        *UnionH5Info `json:"h5_info,omitempty"`
}

type UnionCommonSubOrder struct {
	Mchid       *string          `json:"mchid,omitempty"`
	OutTradeNo  *string          `json:"out_trade_no,omitempty"`
	Amount      *UnionAmountInfo `json:"amount,omitempty"`
	Attach      *string          `json:"attach,omitempty"`
	Description *string          `json:"description,omitempty"`
	GoodsTag    *string          `json:"goods_tag,omitempty"`
	SettleInfo  *UnionSettleInfo `json:"settle_info,omitempty"`
}

type UnionH5Info struct {
	Type        *string `json:"type,omitempty"`
	AppName     *string `json:"app_name,omitempty"`
	AppUrl      *string `json:"app_url,omitempty"`
	BundleId    *string `json:"bundle_id,omitempty"`
	PackageName *string `json:"package_name,omitempty"`
}

type UnionAmountInfo struct {
	TotalAmount *int64  `json:"total_amount,omitempty"`
	Currency    *string `json:"currency,omitempty"`
}

type UnionSettleInfo struct {
	ProfitSharing *bool `json:"profit_sharing,omitempty"`
}
