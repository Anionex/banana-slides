package main

import (
	"demo/wxpay_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/v3/merchant/4015119334
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
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

	request := &SplitBillRequest{
		BillDate: wxpay_utility.String("2019-06-11"),
		TarType:  SPLITBILLTARTYPE_GZIP.Ptr(),
	}

	response, err := SplitBill(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}

func SplitBill(config *wxpay_utility.MchConfig, request *SplitBillRequest) (response *SplitBillResponse, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "GET"
		path   = "/v3/profitsharing/bills"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	query := reqUrl.Query()
	if request.BillDate != nil {
		query.Add("bill_date", *request.BillDate)
	}
	if request.TarType != nil {
		query.Add("tar_type", fmt.Sprintf("%v", *request.TarType))
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
		response := &SplitBillResponse{}
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

type SplitBillRequest struct {
	BillDate *string           `json:"bill_date,omitempty"`
	TarType  *SplitBillTarType `json:"tar_type,omitempty"`
}

func (o *SplitBillRequest) MarshalJSON() ([]byte, error) {
	type Alias SplitBillRequest
	a := &struct {
		BillDate *string           `json:"bill_date,omitempty"`
		TarType  *SplitBillTarType `json:"tar_type,omitempty"`
		*Alias
	}{
		// 序列化时移除非 Body 字段
		BillDate: nil,
		TarType:  nil,
		Alias:    (*Alias)(o),
	}
	return json.Marshal(a)
}

type SplitBillResponse struct {
	HashType    *SplitBillHashType `json:"hash_type,omitempty"`
	HashValue   *string            `json:"hash_value,omitempty"`
	DownloadUrl *string            `json:"download_url,omitempty"`
}

type SplitBillTarType string

func (e SplitBillTarType) Ptr() *SplitBillTarType {
	return &e
}

const (
	SPLITBILLTARTYPE_GZIP SplitBillTarType = "GZIP"
)

type SplitBillHashType string

func (e SplitBillHashType) Ptr() *SplitBillHashType {
	return &e
}

const (
	SPLITBILLHASHTYPE_SHA1 SplitBillHashType = "SHA1"
)
