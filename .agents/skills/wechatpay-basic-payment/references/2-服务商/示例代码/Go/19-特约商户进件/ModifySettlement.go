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

// 修改结算账户
//
// 服务商/电商平台（不包括支付机构、银行），可使用本接口，修改其进件且已签约特约商户/二级商户的结算银行账户。
//
// 注意：
// 1、提交结算银行账户修改申请后，应答代码为"200"且系统返回申请单号，需通过"查询结算账户修改申请状态API"查询申请单处理结果。
//    申请单状态：① 审核中 ② 审核驳回 ③ 审核成功
// 2、如需查询当前生效中的银行结算账户，请使用"查询结算账户API"。
// 3、特约商户/二级商户每天仅能提交5次修改申请，如需继续申请，请等到次日0点后重新发起。
// 4、修改结算银行卡接口调用频率限制：20/min。

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

	request := &ModifySettlementRequest{
		SubMchid:      wxpay_utility.String("1900006491"),
		AccountType:   BANKACCOUNTTYPE_ACCOUNT_TYPE_BUSINESS.Ptr(),
		AccountBank:   wxpay_utility.String("工商银行"),
		BankName:      wxpay_utility.String("中国工商银行股份有限公司北京市分行营业部"),
		BankBranchId:  wxpay_utility.String("402713354941"),
		AccountNumber: wxpay_utility.String("d+xT+MQCvrLHUVDWv/8MR/dB7TkXM2YYZlokmXzFsWs35NXUot7C0NcxIrUF5FnxqCJHkNgKtxa6RxEYyba1+VBRLnqKG2fSy/Y5qDN08Ej9zHCwJjq52Wg1VG8MRugli9YMI1fI83KGBxhuXyemgS/hqFKsfYGiOkJqjTUpgY5VqjtL2N4l4z11T0ECB/aSyVXUysOFGLVfSrUxMPZy6jWWYGvT1+4P633f+R+ki1gT4WF/2KxZOYmli385ZgVhcR30mr4/G3HBcxi13zp7FnEeOsLlvBmI1PHN4C7Rsu3WL8sPndjXTd75kPkyjqnoMRrEEaYQE8ZRGYoeorwC+w=="), /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
		AccountName:   wxpay_utility.String("VyOMa+SncfM4lLha65dsxZ/xYW1zqBVVp6/W5mNkolESJU9fqgMt0lxjtuiWdhR+qUjnC2dTfuJuCOZs/Qi6kmicogGFjDC9ZxzFpdjR7AidWDuCIId5WRnRN8lGUcVyxctZZ4WcxxL2ADq57h7dZoFxNgyRYR4Y6q37LpYDccmYO5SiCkUP3rMX1CrTwKJysVhHij62HiU/P/yScImgdKrc+/MBWb1O6TT2RgwU3U6IwSZRWx4QH4EmYBLAQTdcEyUz2wuDmPA4nMSeXJVyzKl/WB+QYBh4Yj+BLT0HkA2IbTRyGX1U2wvv3N/w59Xq0pWYSXMHlmxhle2Cqj/7Cw=="), /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
	}

	response, err := ModifySettlement(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		return
	}

	fmt.Printf("请求成功: %+v\n", response)
}

func ModifySettlement(config *wxpay_utility.MchConfig, request *ModifySettlementRequest) (response *ModifySettlementResponse, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/v3/apply4sub/sub_merchants/{sub_mchid}/modify-settlement"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
	reqUrl.Path = strings.Replace(reqUrl.Path, "{sub_mchid}", url.PathEscape(*request.SubMchid), -1)
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
		err = wxpay_utility.ValidateResponse(config.WechatPayPublicKeyId(), config.WechatPayPublicKey(), &httpResponse.Header, respBody)
		if err != nil {
			return nil, err
		}
		response := &ModifySettlementResponse{}
		if err := json.Unmarshal(respBody, response); err != nil {
			return nil, err
		}
		return response, nil
	} else {
		return nil, wxpay_utility.NewApiException(httpResponse.StatusCode, httpResponse.Header, respBody)
	}
}

type ModifySettlementRequest struct {
	SubMchid      *string          `json:"sub_mchid,omitempty"`
	AccountType   *BankAccountType `json:"account_type,omitempty"`
	AccountBank   *string          `json:"account_bank,omitempty"`
	BankName      *string          `json:"bank_name,omitempty"`
	BankBranchId  *string          `json:"bank_branch_id,omitempty"`
	AccountNumber *string          `json:"account_number,omitempty"`
	AccountName   *string          `json:"account_name,omitempty"`
}

func (o *ModifySettlementRequest) MarshalJSON() ([]byte, error) {
	type Alias ModifySettlementRequest
	a := &struct {
		SubMchid *string `json:"sub_mchid,omitempty"`
		*Alias
	}{
		SubMchid: nil,
		Alias:    (*Alias)(o),
	}
	return json.Marshal(a)
}

type ModifySettlementResponse struct {
	ApplicationNo *string `json:"application_no,omitempty"`
}

type BankAccountType string
func (e BankAccountType) Ptr() *BankAccountType { return &e }
const (
	BANKACCOUNTTYPE_ACCOUNT_TYPE_BUSINESS BankAccountType = "ACCOUNT_TYPE_BUSINESS"
	BANKACCOUNTTYPE_ACCOUNT_TYPE_PRIVATE  BankAccountType = "ACCOUNT_TYPE_PRIVATE"
)
