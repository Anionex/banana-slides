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

	request := &AssociateStoresForStockBundleRequest{
		ProductCouponId: wxpay_utility.String("200000001"),
		StockBundleId:   wxpay_utility.String("123456789"),
		StoreList: []StoreInfo{StoreInfo{
			StoreId: wxpay_utility.String("100000001"),
		}},
		BrandId: wxpay_utility.String("120344"),
	}

	response, err := AssociateStoresForStockBundle(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}

func AssociateStoresForStockBundle(config *wxpay_utility.MchConfig, request *AssociateStoresForStockBundleRequest) (response *AssociateStoresResponse, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/v3/marketing/partner/product-coupon/product-coupons/{product_coupon_id}/stock-bundles/{stock_bundle_id}/associate-stores"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	reqUrl.Path = strings.Replace(reqUrl.Path, "{product_coupon_id}", url.PathEscape(*request.ProductCouponId), -1)
	reqUrl.Path = strings.Replace(reqUrl.Path, "{stock_bundle_id}", url.PathEscape(*request.StockBundleId), -1)
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
		response := &AssociateStoresResponse{}
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

type AssociateStoresForStockBundleRequest struct {
	ProductCouponId *string     `json:"product_coupon_id,omitempty"`
	StockBundleId   *string     `json:"stock_bundle_id,omitempty"`
	StoreList       []StoreInfo `json:"store_list,omitempty"`
	BrandId         *string     `json:"brand_id,omitempty"`
}

func (o *AssociateStoresForStockBundleRequest) MarshalJSON() ([]byte, error) {
	type Alias AssociateStoresForStockBundleRequest
	a := &struct {
		ProductCouponId *string `json:"product_coupon_id,omitempty"`
		StockBundleId   *string `json:"stock_bundle_id,omitempty"`
		*Alias
	}{
		// 序列化时移除非 Body 字段
		ProductCouponId: nil,
		StockBundleId:   nil,
		Alias:           (*Alias)(o),
	}
	return json.Marshal(a)
}

type AssociateStoresResponse struct {
	TotalCount       *int64            `json:"total_count,omitempty"`
	SuccessStoreList []StoreInfo       `json:"success_store_list,omitempty"`
	FailedStoreList  []FailedStoreInfo `json:"failed_store_list,omitempty"`
}

type StoreInfo struct {
	StoreId *string `json:"store_id,omitempty"`
}

type FailedStoreInfo struct {
	StoreId *string `json:"store_id,omitempty"`
	Code    *string `json:"code,omitempty"`
	Message *string `json:"message,omitempty"`
}
