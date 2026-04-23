package main

import (
	"bytes"
	"demo/wxpay_utility"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
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

	request := &OpenAdvertisingShowRequest{
		SubMchid:                   wxpay_utility.String("1900000109"),
		AdvertisingIndustryFilters: []IndustryType{INDUSTRYTYPE_E_COMMERCE},
	}

	err = OpenAdvertisingShow(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		return
	}

	fmt.Println("请求成功")
}

func OpenAdvertisingShow(config *wxpay_utility.MchConfig, request *OpenAdvertisingShowRequest) (err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "PATCH"
		path   = "/v3/goldplan/merchants/open-advertising-show"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return err
	}
	reqBody, err := json.Marshal(request)
	if err != nil {
		return err
	}
	httpRequest, err := http.NewRequest(method, reqUrl.String(), bytes.NewReader(reqBody))
	if err != nil {
		return err
	}
	httpRequest.Header.Set("Accept", "application/json")
	httpRequest.Header.Set("Wechatpay-Serial", config.WechatPayPublicKeyId())
	httpRequest.Header.Set("Content-Type", "application/json")
	authorization, err := wxpay_utility.BuildAuthorization(config.MchId(), config.CertificateSerialNo(), config.PrivateKey(), method, reqUrl.RequestURI(), reqBody)
	if err != nil {
		return err
	}
	httpRequest.Header.Set("Authorization", authorization)

	client := &http.Client{}
	httpResponse, err := client.Do(httpRequest)
	if err != nil {
		return err
	}
	respBody, err := wxpay_utility.ExtractResponseBody(httpResponse)
	if err != nil {
		return err
	}
	if httpResponse.StatusCode >= 200 && httpResponse.StatusCode < 300 {
		err = wxpay_utility.ValidateResponse(config.WechatPayPublicKeyId(), config.WechatPayPublicKey(), &httpResponse.Header, respBody)
		if err != nil {
			return err
		}
		return nil
	} else {
		return wxpay_utility.NewApiException(httpResponse.StatusCode, httpResponse.Header, respBody)
	}
}

type OpenAdvertisingShowRequest struct {
	SubMchid                   *string        `json:"sub_mchid,omitempty"`
	AdvertisingIndustryFilters []IndustryType `json:"advertising_industry_filters,omitempty"`
}

type IndustryType string

func (e IndustryType) Ptr() *IndustryType { return &e }

const (
	INDUSTRYTYPE_E_COMMERCE        IndustryType = "E_COMMERCE"
	INDUSTRYTYPE_LOVE_MARRIAGE     IndustryType = "LOVE_MARRIAGE"
	INDUSTRYTYPE_POTOGRAPHY        IndustryType = "POTOGRAPHY"
	INDUSTRYTYPE_EDUCATION         IndustryType = "EDUCATION"
	INDUSTRYTYPE_FINANCE           IndustryType = "FINANCE"
	INDUSTRYTYPE_TOURISM           IndustryType = "TOURISM"
	INDUSTRYTYPE_SKINCARE          IndustryType = "SKINCARE"
	INDUSTRYTYPE_FOOD              IndustryType = "FOOD"
	INDUSTRYTYPE_SPORT             IndustryType = "SPORT"
	INDUSTRYTYPE_JEWELRY_WATCH     IndustryType = "JEWELRY_WATCH"
	INDUSTRYTYPE_HEALTHCARE        IndustryType = "HEALTHCARE"
	INDUSTRYTYPE_BUSSINESS         IndustryType = "BUSSINESS"
	INDUSTRYTYPE_PARENTING         IndustryType = "PARENTING"
	INDUSTRYTYPE_CATERING          IndustryType = "CATERING"
	INDUSTRYTYPE_RETAIL            IndustryType = "RETAIL"
	INDUSTRYTYPE_SERVICES          IndustryType = "SERVICES"
	INDUSTRYTYPE_LAW               IndustryType = "LAW"
	INDUSTRYTYPE_ESTATE            IndustryType = "ESTATE"
	INDUSTRYTYPE_TRANSPORTATION    IndustryType = "TRANSPORTATION"
	INDUSTRYTYPE_ENERGY_SAVING     IndustryType = "ENERGY_SAVING"
	INDUSTRYTYPE_SECURITY          IndustryType = "SECURITY"
	INDUSTRYTYPE_BUILDING_MATERIAL IndustryType = "BUILDING_MATERIAL"
	INDUSTRYTYPE_COMMUNICATION     IndustryType = "COMMUNICATION"
	INDUSTRYTYPE_MERCHANDISE       IndustryType = "MERCHANDISE"
	INDUSTRYTYPE_ASSOCIATION       IndustryType = "ASSOCIATION"
	INDUSTRYTYPE_COMMUNITY         IndustryType = "COMMUNITY"
	INDUSTRYTYPE_ONLINE_AVR        IndustryType = "ONLINE_AVR"
	INDUSTRYTYPE_WE_MEDIA          IndustryType = "WE_MEDIA"
	INDUSTRYTYPE_CAR               IndustryType = "CAR"
	INDUSTRYTYPE_SOFTWARE          IndustryType = "SOFTWARE"
	INDUSTRYTYPE_GAME              IndustryType = "GAME"
	INDUSTRYTYPE_CLOTHING          IndustryType = "CLOTHING"
	INDUSTRYTYPE_INDUSTY           IndustryType = "INDUSTY"
	INDUSTRYTYPE_AGRICULTURE       IndustryType = "AGRICULTURE"
	INDUSTRYTYPE_PUBLISHING_MEDIA  IndustryType = "PUBLISHING_MEDIA"
	INDUSTRYTYPE_HOME_DIGITAL      IndustryType = "HOME_DIGITAL"
)
