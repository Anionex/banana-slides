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

	request := &UploadCouponCodesRequest{
		OutRequestNo:    wxpay_brand_utility.String("upload_34657_20250101_123456"),
		ProductCouponId: wxpay_brand_utility.String("1000000013"),
		StockId:         wxpay_brand_utility.String("1000000013001"),
		CodeList: []string{
			"code_0000001",
			"code_0000002",
			"code_0000003",
		},
	}

	response, err := UploadCouponCodes(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}

func UploadCouponCodes(config *wxpay_brand_utility.BrandConfig, request *UploadCouponCodesRequest) (response *UploadCouponCodesResponse, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/brand/marketing/product-coupon/product-coupons/{product_coupon_id}/stocks/{stock_id}/upload-coupon-codes"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	reqUrl.Path = strings.Replace(reqUrl.Path, "{product_coupon_id}", url.PathEscape(*request.ProductCouponId), -1)
	reqUrl.Path = strings.Replace(reqUrl.Path, "{stock_id}", url.PathEscape(*request.StockId), -1)
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
		response := &UploadCouponCodesResponse{}
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

type UploadCouponCodesRequest struct {
	OutRequestNo    *string  `json:"out_request_no,omitempty"`
	ProductCouponId *string  `json:"product_coupon_id,omitempty"`
	StockId         *string  `json:"stock_id,omitempty"`
	CodeList        []string `json:"code_list,omitempty"`
}

func (o *UploadCouponCodesRequest) MarshalJSON() ([]byte, error) {
	type Alias UploadCouponCodesRequest
	a := &struct {
		ProductCouponId *string `json:"product_coupon_id,omitempty"`
		StockId         *string `json:"stock_id,omitempty"`
		*Alias
	}{
		// 序列化时移除非 Body 字段
		ProductCouponId: nil,
		StockId:         nil,
		Alias:           (*Alias)(o),
	}
	return json.Marshal(a)
}

type UploadCouponCodesResponse struct {
	TotalCount           *int64                 `json:"total_count,omitempty"`
	SuccessCodeList      []string               `json:"success_code_list,omitempty"`
	FailedCodeList       []FailedCouponCodeInfo `json:"failed_code_list,omitempty"`
	AlreadyExistCodeList []string               `json:"already_exist_code_list,omitempty"`
	DuplicateCodeList    []string               `json:"duplicate_code_list,omitempty"`
}

type FailedCouponCodeInfo struct {
	CouponCode *string `json:"coupon_code,omitempty"`
	Code       *string `json:"code,omitempty"`
	Message    *string `json:"message,omitempty"`
}
