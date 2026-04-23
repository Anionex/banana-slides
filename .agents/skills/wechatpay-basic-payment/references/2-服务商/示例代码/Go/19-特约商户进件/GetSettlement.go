package main

import (
	"demo/wxpay_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/v3/partner/4015119446
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// 查询结算账户
// 调用频率限制：100/秒。

func main() {
	// TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/partner/4013080340
	config, err := wxpay_utility.CreateMchConfig(
		"19xxxxxxxx",                 // 商户号
		"1DDE55AD98Exxxxxxxxxx",      // 商户API证书序列号
		"/path/to/apiclient_key.pem", // 商户API证书私钥文件路径
		"PUB_KEY_ID_xxxxxxxxxxxxx",   // 微信支付公钥ID
		"/path/to/wxp_pub.pem",       // 微信支付公钥文件路径
	)
	if err != nil {
		fmt.Println(err)
		return
	}

	request := &GetSettlementRequest{
		SubMchid:          wxpay_utility.String("1900006491"),
		AccountNumberRule: ACCOUNTNUMBERRULE_ACCOUNT_NUMBER_RULE_MASK_V1.Ptr(),
	}

	response, err := GetSettlement(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		return
	}

	fmt.Printf("请求成功: %+v\n", response)
}

func GetSettlement(config *wxpay_utility.MchConfig, request *GetSettlementRequest) (response *Settlement, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "GET"
		path   = "/v3/apply4sub/sub_merchants/{sub_mchid}/settlement"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	reqUrl.Path = strings.Replace(reqUrl.Path, "{sub_mchid}", url.PathEscape(*request.SubMchid), -1)
	query := reqUrl.Query()
	if request.AccountNumberRule != nil {
		query.Add("account_number_rule", fmt.Sprintf("%v", *request.AccountNumberRule))
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
		err = wxpay_utility.ValidateResponse(config.WechatPayPublicKeyId(), config.WechatPayPublicKey(), &httpResponse.Header, respBody)
		if err != nil {
			return nil, err
		}
		response := &Settlement{}
		if err := json.Unmarshal(respBody, response); err != nil {
			return nil, err
		}
		return response, nil
	} else {
		return nil, wxpay_utility.NewApiException(httpResponse.StatusCode, httpResponse.Header, respBody)
	}
}

type GetSettlementRequest struct {
	SubMchid          *string            `json:"sub_mchid,omitempty"`
	AccountNumberRule *AccountNumberRule `json:"account_number_rule,omitempty"`
}

func (o *GetSettlementRequest) MarshalJSON() ([]byte, error) {
	type Alias GetSettlementRequest
	a := &struct {
		SubMchid          *string            `json:"sub_mchid,omitempty"`
		AccountNumberRule *AccountNumberRule `json:"account_number_rule,omitempty"`
		*Alias
	}{
		SubMchid:          nil,
		AccountNumberRule: nil,
		Alias:             (*Alias)(o),
	}
	return json.Marshal(a)
}

type Settlement struct {
	AccountType      *BankAccountType `json:"account_type,omitempty"`
	AccountBank      *string          `json:"account_bank,omitempty"`
	BankName         *string          `json:"bank_name,omitempty"`
	BankBranchId     *string          `json:"bank_branch_id,omitempty"`
	AccountNumber    *string          `json:"account_number,omitempty"`
	VerifyResult     *VerifyResult    `json:"verify_result,omitempty"`
	VerifyFailReason *string          `json:"verify_fail_reason,omitempty"`
}

type AccountNumberRule string
func (e AccountNumberRule) Ptr() *AccountNumberRule { return &e }
const (
	ACCOUNTNUMBERRULE_ACCOUNT_NUMBER_RULE_MASK_V1 AccountNumberRule = "ACCOUNT_NUMBER_RULE_MASK_V1"
	ACCOUNTNUMBERRULE_ACCOUNT_NUMBER_RULE_MASK_V2 AccountNumberRule = "ACCOUNT_NUMBER_RULE_MASK_V2"
)

type BankAccountType string
func (e BankAccountType) Ptr() *BankAccountType { return &e }
const (
	BANKACCOUNTTYPE_ACCOUNT_TYPE_BUSINESS BankAccountType = "ACCOUNT_TYPE_BUSINESS"
	BANKACCOUNTTYPE_ACCOUNT_TYPE_PRIVATE  BankAccountType = "ACCOUNT_TYPE_PRIVATE"
)

type VerifyResult string
func (e VerifyResult) Ptr() *VerifyResult { return &e }
const (
	VERIFYRESULT_VERIFY_SUCCESS VerifyResult = "VERIFY_SUCCESS"
	VERIFYRESULT_VERIFY_FAIL    VerifyResult = "VERIFY_FAIL"
	VERIFYRESULT_VERIFYING      VerifyResult = "VERIFYING"
)
