package main

import (
	"demo/wxpay_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/v3/partner/4015119446
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

func main() {
	config, err := wxpay_utility.CreateMchConfig(
		"19xxxxxxxx",
		"1DDE55AD98Exxxxxxxxxx",
		"/path/to/apiclient_key.pem",
		"PUB_KEY_ID_xxxxxxxxxxxxx",
		"/path/to/wxp_pub.pem",
	)
	if err != nil {
		fmt.Println(err)
		return
	}

	request := &QueryMerchantRatioRequest{
		SubMchid: wxpay_utility.String("1900000109"),
	}

	response, err := QueryMerchantRatio(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		return
	}

	fmt.Printf("请求成功: %+v\n", response)
}

func QueryMerchantRatio(config *wxpay_utility.MchConfig, request *QueryMerchantRatioRequest) (response *QueryMerchantRatioResponse, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "GET"
		path   = "/v3/profitsharing/merchant-configs/{sub_mchid}"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	reqUrl.Path = strings.Replace(reqUrl.Path, "{sub_mchid}", url.PathEscape(*request.SubMchid), -1)
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
		err = wxpay_utility.ValidateResponse(config.WechatPayPublicKeyId(), config.WechatPayPublicKey(), &httpResponse.Header, respBody)
		if err != nil {
			return nil, err
		}
		response := &QueryMerchantRatioResponse{}
		if err := json.Unmarshal(respBody, response); err != nil {
			return nil, err
		}
		return response, nil
	} else {
		return nil, wxpay_utility.NewApiException(httpResponse.StatusCode, httpResponse.Header, respBody)
	}
}

type QueryMerchantRatioRequest struct {
	SubMchid *string `json:"sub_mchid,omitempty"`
}

func (o *QueryMerchantRatioRequest) MarshalJSON() ([]byte, error) {
	type Alias QueryMerchantRatioRequest
	a := &struct {
		SubMchid *string `json:"sub_mchid,omitempty"`
		*Alias
	}{
		SubMchid: nil,
		Alias:    (*Alias)(o),
	}
	return json.Marshal(a)
}

type QueryMerchantRatioResponse struct {
	SubMchid *string `json:"sub_mchid,omitempty"`
	MaxRatio *int64  `json:"max_ratio,omitempty"`
}
