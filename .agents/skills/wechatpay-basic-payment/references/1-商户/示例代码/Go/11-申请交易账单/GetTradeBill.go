package main

import (
	"demo/wxpay_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/v3/merchant/4015119334
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

// 申请交易账单API
//
// 关键注意：
// 1. 次日10点后拉取，API仅支持3个月内单日账单，更早的需在商户平台下载。
// 2. 返回的是下载链接（download_url），需二次请求下载（gzip压缩CSV）。
// 3. 账单金额单位为"元"，与下单API的"分"不同，对账时注意转换。
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

	request := &GetTradeBillRequest{
		BillDate: wxpay_utility.String("2019-06-11"),
		BillType: BILLTYPE_ALL.Ptr(),
		TarType:  TARTYPE_GZIP.Ptr(),
	}

	response, err := GetTradeBill(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}

// GetTradeBill 申请交易账单API
func GetTradeBill(config *wxpay_utility.MchConfig, request *GetTradeBillRequest) (response *QueryBillEntity, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "GET"
		path   = "/v3/bill/tradebill"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	query := reqUrl.Query()
	if request.BillDate != nil {
		query.Add("bill_date", *request.BillDate)
	}
	if request.BillType != nil {
		query.Add("bill_type", fmt.Sprintf("%v", *request.BillType))
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
		response := &QueryBillEntity{}
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

type GetTradeBillRequest struct {
	BillDate *string   `json:"bill_date,omitempty"`
	BillType *BillType `json:"bill_type,omitempty"`
	TarType  *TarType  `json:"tar_type,omitempty"`
}

func (o *GetTradeBillRequest) MarshalJSON() ([]byte, error) {
	type Alias GetTradeBillRequest
	a := &struct {
		BillDate *string   `json:"bill_date,omitempty"`
		BillType *BillType `json:"bill_type,omitempty"`
		TarType  *TarType  `json:"tar_type,omitempty"`
		*Alias
	}{
		// 序列化时移除非 Body 字段
		BillDate: nil,
		BillType: nil,
		TarType:  nil,
		Alias:    (*Alias)(o),
	}
	return json.Marshal(a)
}

type QueryBillEntity struct {
	HashType    *HashType `json:"hash_type,omitempty"`
	HashValue   *string   `json:"hash_value,omitempty"`
	DownloadUrl *string   `json:"download_url,omitempty"`
}

type BillType string

func (e BillType) Ptr() *BillType {
	return &e
}

const (
	BILLTYPE_ALL     BillType = "ALL"
	BILLTYPE_SUCCESS BillType = "SUCCESS"
	BILLTYPE_REFUND  BillType = "REFUND"
)

type TarType string

func (e TarType) Ptr() *TarType {
	return &e
}

const (
	TARTYPE_GZIP TarType = "GZIP"
)

type HashType string

func (e HashType) Ptr() *HashType {
	return &e
}

const (
	HASHTYPE_SHA1 HashType = "SHA1"
)
