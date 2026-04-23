// 【失效商品券接口】示例代码
// SDK工具类（HTTP客户端 + 数据模型）见: ../9-SDK工具类/service_models_and_client.go
// ❗重要：本文件为官方示例代码，只允许替换参数和添加注释，禁止从零编写或拼接修改API路径、签名逻辑、请求结构
package main

import (
	"bytes"
	"demo/wxpay_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/v3/partner/4015119446
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
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

	request := &DeactivateProductCouponRequest{
		OutRequestNo:     wxpay_utility.String("34657_20250101_123456"),
		ProductCouponId:  wxpay_utility.String("1000000013"),
		DeactivateReason: wxpay_utility.String("商品券信息有误，重新创建"),
		BrandId:          wxpay_utility.String("120344"),
	}

	response, err := DeactivateProductCoupon(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}

func DeactivateProductCoupon(config *wxpay_utility.MchConfig, request *DeactivateProductCouponRequest) (response *ProductCouponEntity, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/v3/marketing/partner/product-coupon/product-coupons/{product_coupon_id}/deactivate"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	reqUrl.Path = strings.Replace(reqUrl.Path, "{product_coupon_id}", url.PathEscape(*request.ProductCouponId), -1)
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
		response := &ProductCouponEntity{}
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

type DeactivateProductCouponRequest struct {
	OutRequestNo     *string `json:"out_request_no,omitempty"`
	ProductCouponId  *string `json:"product_coupon_id,omitempty"`
	DeactivateReason *string `json:"deactivate_reason,omitempty"`
	BrandId          *string `json:"brand_id,omitempty"`
}

func (o *DeactivateProductCouponRequest) MarshalJSON() ([]byte, error) {
	type Alias DeactivateProductCouponRequest
	a := &struct {
		ProductCouponId *string `json:"product_coupon_id,omitempty"`
		*Alias
	}{
		// 序列化时移除非 Body 字段
		ProductCouponId: nil,
		Alias:           (*Alias)(o),
	}
	return json.Marshal(a)
}

type ProductCouponEntity struct {
	ProductCouponId            *string                     `json:"product_coupon_id,omitempty"`
	Scope                      *ProductCouponScope         `json:"scope,omitempty"`
	Type                       *ProductCouponType          `json:"type,omitempty"`
	UsageMode                  *UsageMode                  `json:"usage_mode,omitempty"`
	SingleUsageInfo            *SingleUsageInfo            `json:"single_usage_info,omitempty"`
	ProgressiveBundleUsageInfo *ProgressiveBundleUsageInfo `json:"progressive_bundle_usage_info,omitempty"`
	DisplayInfo                *ProductCouponDisplayInfo   `json:"display_info,omitempty"`
	OutProductNo               *string                     `json:"out_product_no,omitempty"`
	State                      *ProductCouponState         `json:"state,omitempty"`
	DeactivateRequestNo        *string                     `json:"deactivate_request_no,omitempty"`
	DeactivateTime             *string                     `json:"deactivate_time,omitempty"`
	DeactivateReason           *string                     `json:"deactivate_reason,omitempty"`
	BrandId                    *string                     `json:"brand_id,omitempty"`
}

type ProductCouponScope string

func (e ProductCouponScope) Ptr() *ProductCouponScope {
	return &e
}

const (
	PRODUCTCOUPONSCOPE_ALL    ProductCouponScope = "ALL"
	PRODUCTCOUPONSCOPE_SINGLE ProductCouponScope = "SINGLE"
)

type ProductCouponType string

func (e ProductCouponType) Ptr() *ProductCouponType {
	return &e
}

const (
	PRODUCTCOUPONTYPE_NORMAL   ProductCouponType = "NORMAL"
	PRODUCTCOUPONTYPE_DISCOUNT ProductCouponType = "DISCOUNT"
	PRODUCTCOUPONTYPE_EXCHANGE ProductCouponType = "EXCHANGE"
)

type UsageMode string

func (e UsageMode) Ptr() *UsageMode {
	return &e
}

const (
	USAGEMODE_SINGLE             UsageMode = "SINGLE"
	USAGEMODE_PROGRESSIVE_BUNDLE UsageMode = "PROGRESSIVE_BUNDLE"
)

type SingleUsageInfo struct {
	NormalCoupon   *NormalCouponUsageRule   `json:"normal_coupon,omitempty"`
	DiscountCoupon *DiscountCouponUsageRule `json:"discount_coupon,omitempty"`
}

type ProgressiveBundleUsageInfo struct {
	Count        *int64 `json:"count,omitempty"`
	IntervalDays *int64 `json:"interval_days,omitempty"`
}

type ProductCouponDisplayInfo struct {
	Name               *string        `json:"name,omitempty"`
	ImageUrl           *string        `json:"image_url,omitempty"`
	BackgroundUrl      *string        `json:"background_url,omitempty"`
	DetailImageUrlList []string       `json:"detail_image_url_list,omitempty"`
	OriginalPrice      *int64         `json:"original_price,omitempty"`
	ComboPackageList   []ComboPackage `json:"combo_package_list,omitempty"`
}

type ProductCouponState string

func (e ProductCouponState) Ptr() *ProductCouponState {
	return &e
}

const (
	PRODUCTCOUPONSTATE_AUDITING    ProductCouponState = "AUDITING"
	PRODUCTCOUPONSTATE_EFFECTIVE   ProductCouponState = "EFFECTIVE"
	PRODUCTCOUPONSTATE_DEACTIVATED ProductCouponState = "DEACTIVATED"
)

type NormalCouponUsageRule struct {
	Threshold      *int64 `json:"threshold,omitempty"`
	DiscountAmount *int64 `json:"discount_amount,omitempty"`
}

type DiscountCouponUsageRule struct {
	Threshold  *int64 `json:"threshold,omitempty"`
	PercentOff *int64 `json:"percent_off,omitempty"`
}

type ComboPackage struct {
	Name       *string              `json:"name,omitempty"`
	PickCount  *int64               `json:"pick_count,omitempty"`
	ChoiceList []ComboPackageChoice `json:"choice_list,omitempty"`
}

type ComboPackageChoice struct {
	Name             *string `json:"name,omitempty"`
	Price            *int64  `json:"price,omitempty"`
	Count            *int64  `json:"count,omitempty"`
	ImageUrl         *string `json:"image_url,omitempty"`
	MiniProgramAppid *string `json:"mini_program_appid,omitempty"`
	MiniProgramPath  *string `json:"mini_program_path,omitempty"`
}
