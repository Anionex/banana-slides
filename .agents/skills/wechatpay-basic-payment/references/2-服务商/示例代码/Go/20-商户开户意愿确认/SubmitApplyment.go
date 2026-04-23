package main

import (
	"bytes"
	"demo/wxpay_utility" // 引用微信支付工具库，参考 https://pay.weixin.qq.com/doc/v3/partner/4015119446
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
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

	request := &SubmitApplymentRequest{
		ChannelId:    wxpay_utility.String("20001111"),
		BusinessCode: wxpay_utility.String("1900013511_10000"),
		ContactInfo: &ContactInfo{
			Name:                 wxpay_utility.String("pVd1HJ6zyvPedzGaV+X3IdGdbDnuC4Eelw/wDa4SzfeespQO/0kjiwfqdfg=="),                                                 /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
			Mobile:               wxpay_utility.String("Oiw4DS+QVyZKC3eTd7CGvGQ1/sidmLm8mdsohkuR9jSiwXyHyVQD1OA1t+6Pb+Xn0q2HAJYLsNjh8O4S1iQgMrFohyaNms4IlDxJzujb9VA=="), /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
			IdCardNumber:         wxpay_utility.String("pVd1HJ6zmty7/mYNxLMpRSvMRtelw/wDa4SzfeespQO/0kjiwfqdfg=="),                                                      /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
			ContactType:          IDHOLDERTYPE_LEGAL.Ptr(),
			ContactIdDocType:     IDENTIFICATIONTYPE_IDENTIFICATION_TYPE_IDCARD.Ptr(),
			ContactIdDocCopy:     wxpay_utility.String("jTpGmxUXqRTvDujqhThn4ReFxikqJ5YW6zFQ"),
			ContactIdDocCopyBack: wxpay_utility.String("jTpGmxUX3FBWVQ5NJTZvvDujqhThn4ReFxikqJ5YW6zFQ"),
			ContactPeriodBegin:   wxpay_utility.String("2019-06-06"),
			ContactPeriodEnd:     wxpay_utility.String("2026-06-06"),
		},
		SubjectInfo: &SubjectInfo{
			SubjectType:          SUBJECTTYPE_SUBJECT_TYPE_ENTERPRISE.Ptr(),
			IsFinanceInstitution: wxpay_utility.Bool(false),
			BusinessLicenceInfo: &BusinessLicenceInfo{
				LicenceNumber:    wxpay_utility.String("914201123033363296"),
				LicenceCopy:      wxpay_utility.String("0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo"),
				MerchantName:     wxpay_utility.String("李四网络有限公司"),
				LegalPerson:      wxpay_utility.String("李四"),
				CompanyAddress:   wxpay_utility.String("广东省深圳市南山区xx路xx号"),
				LicenceValidDate: wxpay_utility.String("[\"2017-10-28\",\"2037-10-28\"]"),
			},
			CertificateInfo: &CertificateInfo{
				CertType:       CERTIFICATETYPE_CERTIFICATE_TYPE_2388.Ptr(),
				CertNumber:     wxpay_utility.String("111111111111"),
				CertCopy:       wxpay_utility.String("0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo"),
				MerchantName:   wxpay_utility.String("xx公益团体"),
				LegalPerson:    wxpay_utility.String("李四"),
				CompanyAddress: wxpay_utility.String("广东省深圳市南山区xx路xx号"),
				CertValidDate:  wxpay_utility.String("[\"2017-10-28\",\"2037-10-28\"]"),
			},
			CompanyProveCopy: wxpay_utility.String("0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo"),
			AssistProveInfo: &AssitProveInfo{
				MicroBizType:     MICROBIZTYPE_MICRO_TYPE_STORE.Ptr(),
				StoreName:        wxpay_utility.String("大郎烧饼"),
				StoreAddressCode: wxpay_utility.String("440305"),
				StoreAddress:     wxpay_utility.String("广东省深圳市南山区xx大厦x层xxxx室"),
				StoreHeaderCopy:  wxpay_utility.String("0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo"),
				StoreIndoorCopy:  wxpay_utility.String("0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo"),
			},
			SpecialOperationList: []SpecialOperation{SpecialOperation{
				CategoryId:        wxpay_utility.Int64(100),
				OperationCopyList: []string{"0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo"},
			}},
			FinanceInstitutionInfo: &FinanceInstitutionInfo{
				FinanceType:        FINANCETYPE_BANK_AGENT.Ptr(),
				FinanceLicensePics: []string{"0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo"},
			},
		},
		IdentificationInfo: &IdentificationInfo{
			IdHolderType:            IDHOLDERTYPE_LEGAL.Ptr(),
			IdentificationType:      IDENTIFICATIONTYPE_IDENTIFICATION_TYPE_IDCARD.Ptr(),
			IdentificationName:      wxpay_utility.String("MZnwEx6zotwIz6ctW2/iQL5z94odwP9sKiF74RPCPztcJOScaXsaGs82HJNU3K+46ndk7pMrENiPDw=="), /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
			IdentificationNumber:    wxpay_utility.String("ZTnn5dKGCvP4csw4XTLug/+VLB+4R6nxSPQwqSpmPVZtXmye+/3s9O+y32w=="),                    /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
			IdentificationValidDate: wxpay_utility.String("[\"2017-10-28\",\"2037-10-28\"]"),
			IdentificationFrontCopy: wxpay_utility.String("0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo"),
			IdentificationBackCopy:  wxpay_utility.String("0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo"),
			AuthorizeLetterCopy:     wxpay_utility.String("0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo"),
			Owner:                   wxpay_utility.Bool(false),
			IdentificationAddress:   wxpay_utility.String("pVd1HJ6zyvPedzGaV+X3qtmrq9bb9tPROvwia4ibL+F6mfjbzQIzfb3HHLEjZ4YiR/cJiCrZxnAqi+pjeKIEdkwzXRAI7FUhrfPK3SNjaBTEu9GmsugMIA9r3x887Q+ODuC8HH2nzAn7NGpE/e3yiHgWhk0ps5k5DP/2qIdGdONoDzZelrxCl/NWWNUyB93K9F+jC1JX2IMttdY+aQ6zBlw0xnOiNW6Hzy7UtC+xriudjD5APomty7/mYNxLMpRSvWKIjOv/69bDnuC4EL5Kz4jBHLiCyOb+tI0m2qhZ9evAM+Jv1z0NVa8MRtelw/wDa4SzfeespQO/0kjiwfqdfg=="), /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
		},
		UboInfo: &UboInfo{
			UboIdType:          IDENTIFICATIONTYPE_IDENTIFICATION_TYPE_IDCARD.Ptr(),
			UboIdCardCopy:      wxpay_utility.String("jTpGmxUX3FBWVQ5NJTZvlKX_gdU4cRz7z5NxpnFuAxhBTEO_PvWkfSCJ3zVIn001D8daLC-ehEuo0BJqRTvDujqhThn4ReFxikqJ5YW6zFQ"),
			UboIdCardNational:  wxpay_utility.String("jTpGmxUX3FBWVQ5NJTZvlKX_gdU4cRz7z5NxpnFuAxhBTEO_PvWkfSCJ3zVIn001D8daLC-ehEuo0BJqRTvDujqhThn4ReFxikqJ5YW6zFQ"),
			UboIdDocCopy:       wxpay_utility.String("jTpGmxUX3FBWVQ5NJTZvlKX_gdU4cRz7z5NxpnFuAxhBTEO_PvWkfSCJ3zVIn001D8daLC-ehEuo0BJqRTvDujqhThn4ReFxikqJ5YW6zFQ"),
			UboName:            wxpay_utility.String("AOZdYGISxo4y44/Ug4P4TG5xzchG/5IL9DBd+Z0zZXkw=="), /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
			UboIdNumber:        wxpay_utility.String("AOZdYGISxo4y44/Ug4P4TG5xzchG/5IL9DBd+Z0zZXkw=="), /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
			UboIdCardValidDate: wxpay_utility.String("[\"2017-10-28\",\"2037-10-28\"]"),
		},
		AdditionInfo: &AdditionInfo{
			ConfirmMchidList: []string{"example_ConfirmMchidList"},
		},
		UboInfoList: []UboInfoList{UboInfoList{
			UboIdDocType:     IDENTIFICATIONTYPE_IDENTIFICATION_TYPE_IDCARD.Ptr(),
			UboIdDocCopy:     wxpay_utility.String("jTpGmxUXqRTvDujqhThn4ReFxikqJ5YW6zFQ"),
			UboIdDocCopyBack: wxpay_utility.String("jTpGmxUX3FBWVQ5NJTZvvDujqhThn4ReFxikqJ5YW6zFQ"),
			UboIdDocName:     wxpay_utility.String("AOZdYGISxo4y44/Ug4P4TG5xzchG/5IL9DBd+Z0zZXkw=="),                                                                                                                                                                                                                                                                                                           /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
			UboIdDocNumber:   wxpay_utility.String("AOZdYGISxo4y44/Ug4P4TG5xzchG/5IL9DBd+Z0zZXkw=="),                                                                                                                                                                                                                                                                                                           /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
			UboIdDocAddress:  wxpay_utility.String("pVd1HJ6zyvPedzGaV+X3qtmrq9bb9tPROvwia4ibL+F6mfjbzQIzfb3HHLEjZ4YiR/cJiCrZxnAqi+pjeKIEdkwzXRAI7FUhrfPK3SNjaBTEu9GmsugMIA9r3x887Q+ODuC8HH2nzAn7NGpE/e3yiHgWhk0ps5k5DP/2qIdGdONoDzZelrxCl/NWWNUyB93K9F+jC1JX2IMttdY+aQ6zBlw0xnOiNW6Hzy7UtC+xriudjD5APomty7/mYNxLMpRSvWKIjOv/69bDnuC4EL5Kz4jBHLiCyOb+tI0m2qhZ9evAM+Jv1z0NVa8MRtelw/wDa4SzfeespQO/0kjiwfqdfg=="), /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
			UboPeriodBegin:   wxpay_utility.String("2019-06-06"),
			UboPeriodEnd:     wxpay_utility.String("2026-06-06"),
		}},
	}

	response, err := SubmitApplyment(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}

func SubmitApplyment(config *wxpay_utility.MchConfig, request *SubmitApplymentRequest) (response *SubmitApplymentResponse, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/v3/apply4subject/applyment"
	)

	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil {
		return nil, err
	}
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
		response := &SubmitApplymentResponse{}
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

type SubmitApplymentRequest struct {
	ChannelId          *string             `json:"channel_id,omitempty"`
	BusinessCode       *string             `json:"business_code,omitempty"`
	ContactInfo        *ContactInfo        `json:"contact_info,omitempty"`
	SubjectInfo        *SubjectInfo        `json:"subject_info,omitempty"`
	IdentificationInfo *IdentificationInfo `json:"identification_info,omitempty"`
	UboInfo            *UboInfo            `json:"ubo_info,omitempty"`
	AdditionInfo       *AdditionInfo       `json:"addition_info,omitempty"`
	UboInfoList        []UboInfoList       `json:"ubo_info_list,omitempty"`
}

type SubmitApplymentResponse struct {
	ApplymentId *int64 `json:"applyment_id,omitempty"`
}

type ContactInfo struct {
	Name                 *string             `json:"name,omitempty"`
	Mobile               *string             `json:"mobile,omitempty"`
	IdCardNumber         *string             `json:"id_card_number,omitempty"`
	ContactType          *IdHolderType       `json:"contact_type,omitempty"`
	ContactIdDocType     *IdentificationType `json:"contact_id_doc_type,omitempty"`
	ContactIdDocCopy     *string             `json:"contact_id_doc_copy,omitempty"`
	ContactIdDocCopyBack *string             `json:"contact_id_doc_copy_back,omitempty"`
	ContactPeriodBegin   *string             `json:"contact_period_begin,omitempty"`
	ContactPeriodEnd     *string             `json:"contact_period_end,omitempty"`
}

type SubjectInfo struct {
	SubjectType            *SubjectType            `json:"subject_type,omitempty"`
	IsFinanceInstitution   *bool                   `json:"is_finance_institution,omitempty"`
	BusinessLicenceInfo    *BusinessLicenceInfo    `json:"business_licence_info,omitempty"`
	CertificateInfo        *CertificateInfo        `json:"certificate_info,omitempty"`
	CompanyProveCopy       *string                 `json:"company_prove_copy,omitempty"`
	AssistProveInfo        *AssitProveInfo         `json:"assist_prove_info,omitempty"`
	SpecialOperationList   []SpecialOperation      `json:"special_operation_list,omitempty"`
	FinanceInstitutionInfo *FinanceInstitutionInfo `json:"finance_institution_info,omitempty"`
}

type IdentificationInfo struct {
	IdHolderType            *IdHolderType       `json:"id_holder_type,omitempty"`
	IdentificationType      *IdentificationType `json:"identification_type,omitempty"`
	IdentificationName      *string             `json:"identification_name,omitempty"`
	IdentificationNumber    *string             `json:"identification_number,omitempty"`
	IdentificationValidDate *string             `json:"identification_valid_date,omitempty"`
	IdentificationFrontCopy *string             `json:"identification_front_copy,omitempty"`
	IdentificationBackCopy  *string             `json:"identification_back_copy,omitempty"`
	AuthorizeLetterCopy     *string             `json:"authorize_letter_copy,omitempty"`
	Owner                   *bool               `json:"owner,omitempty"`
	IdentificationAddress   *string             `json:"identification_address,omitempty"`
}

type UboInfo struct {
	UboIdType          *IdentificationType `json:"ubo_id_type,omitempty"`
	UboIdCardCopy      *string             `json:"ubo_id_card_copy,omitempty"`
	UboIdCardNational  *string             `json:"ubo_id_card_national,omitempty"`
	UboIdDocCopy       *string             `json:"ubo_id_doc_copy,omitempty"`
	UboName            *string             `json:"ubo_name,omitempty"`
	UboIdNumber        *string             `json:"ubo_id_number,omitempty"`
	UboIdCardValidDate *string             `json:"ubo_id_card_valid_date,omitempty"`
}

type AdditionInfo struct {
	ConfirmMchidList []string `json:"confirm_mchid_list,omitempty"`
}

type UboInfoList struct {
	UboIdDocType     *IdentificationType `json:"ubo_id_doc_type,omitempty"`
	UboIdDocCopy     *string             `json:"ubo_id_doc_copy,omitempty"`
	UboIdDocCopyBack *string             `json:"ubo_id_doc_copy_back,omitempty"`
	UboIdDocName     *string             `json:"ubo_id_doc_name,omitempty"`
	UboIdDocNumber   *string             `json:"ubo_id_doc_number,omitempty"`
	UboIdDocAddress  *string             `json:"ubo_id_doc_address,omitempty"`
	UboPeriodBegin   *string             `json:"ubo_period_begin,omitempty"`
	UboPeriodEnd     *string             `json:"ubo_period_end,omitempty"`
}

type IdHolderType string

func (e IdHolderType) Ptr() *IdHolderType {
	return &e
}

const (
	IDHOLDERTYPE_LEGAL IdHolderType = "LEGAL"
	IDHOLDERTYPE_SUPER IdHolderType = "SUPER"
)

type IdentificationType string

func (e IdentificationType) Ptr() *IdentificationType {
	return &e
}

const (
	IDENTIFICATIONTYPE_IDENTIFICATION_TYPE_IDCARD                  IdentificationType = "IDENTIFICATION_TYPE_IDCARD"
	IDENTIFICATIONTYPE_IDENTIFICATION_TYPE_OVERSEA_PASSPORT        IdentificationType = "IDENTIFICATION_TYPE_OVERSEA_PASSPORT"
	IDENTIFICATIONTYPE_IDENTIFICATION_TYPE_HONGKONG_PASSPORT       IdentificationType = "IDENTIFICATION_TYPE_HONGKONG_PASSPORT"
	IDENTIFICATIONTYPE_IDENTIFICATION_TYPE_MACAO_PASSPORT          IdentificationType = "IDENTIFICATION_TYPE_MACAO_PASSPORT"
	IDENTIFICATIONTYPE_IDENTIFICATION_TYPE_TAIWAN_PASSPORT         IdentificationType = "IDENTIFICATION_TYPE_TAIWAN_PASSPORT"
	IDENTIFICATIONTYPE_IDENTIFICATION_TYPE_FOREIGN_RESIDENT        IdentificationType = "IDENTIFICATION_TYPE_FOREIGN_RESIDENT"
	IDENTIFICATIONTYPE_IDENTIFICATION_TYPE_HONGKONG_MACAO_RESIDENT IdentificationType = "IDENTIFICATION_TYPE_HONGKONG_MACAO_RESIDENT"
	IDENTIFICATIONTYPE_IDENTIFICATION_TYPE_TAIWAN_RESIDENT         IdentificationType = "IDENTIFICATION_TYPE_TAIWAN_RESIDENT"
)

type SubjectType string

func (e SubjectType) Ptr() *SubjectType {
	return &e
}

const (
	SUBJECTTYPE_SUBJECT_TYPE_ENTERPRISE          SubjectType = "SUBJECT_TYPE_ENTERPRISE"
	SUBJECTTYPE_SUBJECT_TYPE_INSTITUTIONS_CLONED SubjectType = "SUBJECT_TYPE_INSTITUTIONS_CLONED"
	SUBJECTTYPE_SUBJECT_TYPE_INDIVIDUAL          SubjectType = "SUBJECT_TYPE_INDIVIDUAL"
	SUBJECTTYPE_SUBJECT_TYPE_OTHERS              SubjectType = "SUBJECT_TYPE_OTHERS"
	SUBJECTTYPE_SUBJECT_TYPE_MICRO               SubjectType = "SUBJECT_TYPE_MICRO"
	SUBJECTTYPE_SUBJECT_TYPE_GOVERNMENT          SubjectType = "SUBJECT_TYPE_GOVERNMENT"
)

type BusinessLicenceInfo struct {
	LicenceNumber    *string `json:"licence_number,omitempty"`
	LicenceCopy      *string `json:"licence_copy,omitempty"`
	MerchantName     *string `json:"merchant_name,omitempty"`
	LegalPerson      *string `json:"legal_person,omitempty"`
	CompanyAddress   *string `json:"company_address,omitempty"`
	LicenceValidDate *string `json:"licence_valid_date,omitempty"`
}

type CertificateInfo struct {
	CertType       *CertificateType `json:"cert_type,omitempty"`
	CertNumber     *string          `json:"cert_number,omitempty"`
	CertCopy       *string          `json:"cert_copy,omitempty"`
	MerchantName   *string          `json:"merchant_name,omitempty"`
	LegalPerson    *string          `json:"legal_person,omitempty"`
	CompanyAddress *string          `json:"company_address,omitempty"`
	CertValidDate  *string          `json:"cert_valid_date,omitempty"`
}

type AssitProveInfo struct {
	MicroBizType     *MicroBizType `json:"micro_biz_type,omitempty"`
	StoreName        *string       `json:"store_name,omitempty"`
	StoreAddressCode *string       `json:"store_address_code,omitempty"`
	StoreAddress     *string       `json:"store_address,omitempty"`
	StoreHeaderCopy  *string       `json:"store_header_copy,omitempty"`
	StoreIndoorCopy  *string       `json:"store_indoor_copy,omitempty"`
}

type SpecialOperation struct {
	CategoryId        *int64   `json:"category_id,omitempty"`
	OperationCopyList []string `json:"operation_copy_list,omitempty"`
}

type FinanceInstitutionInfo struct {
	FinanceType        *FinanceType `json:"finance_type,omitempty"`
	FinanceLicensePics []string     `json:"finance_license_pics,omitempty"`
}

type CertificateType string

func (e CertificateType) Ptr() *CertificateType {
	return &e
}

const (
	CERTIFICATETYPE_CERTIFICATE_TYPE_2388 CertificateType = "CERTIFICATE_TYPE_2388"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2389 CertificateType = "CERTIFICATE_TYPE_2389"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2394 CertificateType = "CERTIFICATE_TYPE_2394"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2395 CertificateType = "CERTIFICATE_TYPE_2395"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2396 CertificateType = "CERTIFICATE_TYPE_2396"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2397 CertificateType = "CERTIFICATE_TYPE_2397"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2398 CertificateType = "CERTIFICATE_TYPE_2398"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2399 CertificateType = "CERTIFICATE_TYPE_2399"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2400 CertificateType = "CERTIFICATE_TYPE_2400"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2390 CertificateType = "CERTIFICATE_TYPE_2390"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2391 CertificateType = "CERTIFICATE_TYPE_2391"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2392 CertificateType = "CERTIFICATE_TYPE_2392"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2393 CertificateType = "CERTIFICATE_TYPE_2393"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2520 CertificateType = "CERTIFICATE_TYPE_2520"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2521 CertificateType = "CERTIFICATE_TYPE_2521"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2522 CertificateType = "CERTIFICATE_TYPE_2522"
)

type MicroBizType string

func (e MicroBizType) Ptr() *MicroBizType {
	return &e
}

const (
	MICROBIZTYPE_MICRO_TYPE_STORE  MicroBizType = "MICRO_TYPE_STORE"
	MICROBIZTYPE_MICRO_TYPE_MOBILE MicroBizType = "MICRO_TYPE_MOBILE"
	MICROBIZTYPE_MICRO_TYPE_ONLINE MicroBizType = "MICRO_TYPE_ONLINE"
)

type FinanceType string

func (e FinanceType) Ptr() *FinanceType {
	return &e
}

const (
	FINANCETYPE_BANK_AGENT       FinanceType = "BANK_AGENT"
	FINANCETYPE_PAYMENT_AGENT    FinanceType = "PAYMENT_AGENT"
	FINANCETYPE_INSURANCE        FinanceType = "INSURANCE"
	FINANCETYPE_TRADE_AND_SETTLE FinanceType = "TRADE_AND_SETTLE"
	FINANCETYPE_OTHER            FinanceType = "OTHER"
)
