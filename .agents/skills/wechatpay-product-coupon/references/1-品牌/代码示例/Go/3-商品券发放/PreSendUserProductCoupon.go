package main

import (
	"bytes"
	"demo/wxpay_brand_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/brand/4015826866
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// 向用户预发放商品券（小程序发券组件）
func main() {
	// TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/brand/4015415289
	config, err := wxpay_brand_utility.CreateBrandConfig(
		"xxxxxxxx",                   // 品牌ID，是由微信支付系统生成并分配给每个品牌方的唯一标识符，品牌ID获取方式参考 https://pay.weixin.qq.com/doc/brand/4015415289
		"1DDE55AD98Exxxxxxxxxx",      // 品牌API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/brand/4015407570
		"/path/to/apiclient_key.pem", // 品牌API证书私钥文件路径，本地文件路径
		"PUB_KEY_ID_xxxxxxxxxxxxx",   // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/brand/4015453439
		"/path/to/wxp_pub.pem",       // 微信支付公钥文件路径，本地文件路径
	)
	if err != nil {
		fmt.Println(err)
		return
	}

	request := &PreSendUserProductCouponRequest{
		Openid:          wxpay_brand_utility.String("oh-394z-6CGkNoJrsDLTTUKiAnp4"),
		ProductCouponId: wxpay_brand_utility.String("200000001"),
		StockId:         wxpay_brand_utility.String("100232301"),
		CouponCode:      wxpay_brand_utility.String("123446565767"),
		Appid:           wxpay_brand_utility.String("wx233544546545989"),
		SendRequestNo:   wxpay_brand_utility.String("34657_20250101_123456"),
		Attach:          wxpay_brand_utility.String("example_attach"),
	}

	response, err := PreSendUserProductCoupon(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}

func PreSendUserProductCoupon(config *wxpay_brand_utility.BrandConfig, request *PreSendUserProductCouponRequest) (response *PreSendUserProductCouponResponse, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/brand/marketing/product-coupon/users/{openid}/pre-send-coupon"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	reqUrl.Path = strings.Replace(reqUrl.Path, "{openid}", url.PathEscape(*request.Openid), -1)
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
	authorization, err := wxpay_brand_utility.BuildAuthorization(config.BrandId(), config.CertificateSerialNo(), config.PrivateKey(), method, reqUrl.RequestURI(), reqBody)
	if err != nil {
		return nil, err
	}
	httpRequest.Header.Set("Authorization", authorization)

	client := &http.Client{}
	httpResponse, err := client.Do(httpRequest)
	if err != nil {
		return nil, err
	}
	respBody, err := wxpay_brand_utility.ExtractResponseBody(httpResponse)
	if err != nil {
		return nil, err
	}
	if httpResponse.StatusCode >= 200 && httpResponse.StatusCode < 300 {
		// 2XX 成功，验证应答签名
		err = wxpay_brand_utility.ValidateResponse(
			config.WechatPayPublicKeyId(),
			config.WechatPayPublicKey(),
			&httpResponse.Header,
			respBody,
		)
		if err != nil {
			return nil, err
		}
		response := &PreSendUserProductCouponResponse{}
		if err := json.Unmarshal(respBody, response); err != nil {
			return nil, err
		}

		return response, nil
	} else {
		return nil, wxpay_brand_utility.NewApiException(
			httpResponse.StatusCode,
			httpResponse.Header,
			respBody,
		)
	}
}

type PreSendUserProductCouponRequest struct {
	ProductCouponId *string `json:"product_coupon_id,omitempty"`
	StockId         *string `json:"stock_id,omitempty"`
	CouponCode      *string `json:"coupon_code,omitempty"`
	Appid           *string `json:"appid,omitempty"`
	Openid          *string `json:"openid,omitempty"`
	SendRequestNo   *string `json:"send_request_no,omitempty"`
	Attach          *string `json:"attach,omitempty"`
}

func (o *PreSendUserProductCouponRequest) MarshalJSON() ([]byte, error) {
	type Alias PreSendUserProductCouponRequest
	a := &struct {
		Openid *string `json:"openid,omitempty"`
		*Alias
	}{
		// 序列化时移除非 Body 字段
		Openid: nil,
		Alias:  (*Alias)(o),
	}
	return json.Marshal(a)
}

type PreSendUserProductCouponResponse struct {
	Token *string `json:"token,omitempty"`
}
