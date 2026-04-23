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

	request := &SubmitReq{
		BusinessCode: wxpay_utility.String("1900013511_10000"),
		ContactInfo: &ContactInfo{
			ContactType:                 IDHOLDERTYPE_LEGAL.Ptr(),
			ContactName:                 wxpay_utility.String("pVd1HJ6zyvPedzGaV+X3qtmrq9bb9tPROvwia4ibL+F6mfjbzQIzfb3HHLEjZ4YiR/cJiCrZxnAqi+pjeKIEdkwzXRAI7FUhrfPK3SNjaBTEu9GmsugMIA9r3x887Q+ODuC8HH2nzAn7NGpE/e3yiHgWhk0ps5k5DP/2qIdGdONoDzZelrxCl/NWWNUyB93K9F+jC1JX2IMttdY+aQ6zBlw0xnOiNW6Hzy7UtC+xriudjD5APomty7/mYNxLMpRSvWKIjOv/69bDnuC4EL5Kz4jBHLiCyOb+tI0m2qhZ9evAM+Jv1z0NVa8MRtelw/wDa4SzfeespQO/0kjiwfqdfg=="), /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
			ContactIdDocType:            IDENTIFICATIONTYPE_IDENTIFICATION_TYPE_IDCARD.Ptr(),
			ContactIdNumber:             wxpay_utility.String("pVd1HJ6zyvPedzGaV+X3qtmrq9bb9tPROvwia4ibL+F6mfjbzQIzfb3HHLEjZ4YiR/cJiCrZxnAqi+pjeKIEdkwzXRAI7FUhrfPK3SNjaBTEu9GmsugMIA9r3x887Q+ODuC8HH2nzAn7NGpE/e3yiHgWhk0ps5k5DP/2qIdGdONoDzZelrxCl/NWWNUyB93K9F+jC1JX2IMttdY+aQ6zBlw0xnOiNW6Hzy7UtC+xriudjD5APomty7/mYNxLMpRSvWKIjOv/69bDnuC4EL5Kz4jBHLiCyOb+tI0m2qhZ9evAM+Jv1z0NVa8MRtelw/wDa4SzfeespQO/0kjiwfqdfg=="), /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
			ContactIdDocCopy:            wxpay_utility.String("jTpGmxUXqRTvDujqhThn4ReFxikqJ5YW6zFQ"),
			ContactIdDocCopyBack:        wxpay_utility.String("jTpGmxUX3FBWVQ5NJTZvvDujqhThn4ReFxikqJ5YW6zFQ"),
			ContactPeriodBegin:          wxpay_utility.String("2019-06-06"),
			ContactPeriodEnd:            wxpay_utility.String("2026-06-06"),
			BusinessAuthorizationLetter: wxpay_utility.String("47ZC6GC-vnrbEny_Ie_An5-tCpqxucuxi-vByf3Gjm7KEIUv0OF4wFNIO4kqg05InE4d2I6_H7I4"),
			Openid:                      wxpay_utility.String("pVd1HJ6zyvPedzGaV+X3qtmrq9bb9tPROvwia4ibL+F6mfjbzQIzfb3HHLEjZ4YiR/cJiCrZxnAqi+pjeKIEdkwzXRAI7FUhrfPK3SNjaBTEu9GmsugMIA9r3x887Q+ODuC8HH2nzAn7NGpE/e3yiHgWhk0ps5k5DP/2qIdGdONoDzZelrxCl/NWWNUyB93K9F+jC1JX2IMttdY+aQ6zBlw0xnOiNW6Hzy7UtC+xriudjD5APomty7/mYNxLMpRSvWKIjOv/69bDnuC4EL5Kz4jBHLiCyOb+tI0m2qhZ9evAM+Jv1z0NVa8MRtelw/wDa4SzfeespQO/0kjiwfqdfg== 字段加密: 使用APIv3定义的方式加密"),
			MobilePhone:                 wxpay_utility.String("pVd1HJ6zyvPedzGaV+X3qtmrq9bb9tPROvwia4ibL+F6mfjbzQIzfb3HHLEjZ4YiR/cJiCrZxnAqi+pjeKIEdkwzXRAI7FUhrfPK3SNjaBTEu9GmsugMIA9r3x887Q+ODuC8HH2nzAn7NGpE/e3yiHgWhk0ps5k5DP/2qIdGdONoDzZelrxCl/NWWNUyB93K9F+jC1JX2IMttdY+aQ6zBlw0xnOiNW6Hzy7UtC+xriudjD5APomty7/mYNxLMpRSvWKIjOv/69bDnuC4EL5Kz4jBHLiCyOb+tI0m2qhZ9evAM+Jv1z0NVa8MRtelw/wDa4SzfeespQO/0kjiwfqdfg=="), /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
			ContactEmail:                wxpay_utility.String("pVd1HJ6zyvPedzGaV+X3qtmrq9bb9tPROvwia4ibL+F6mfjbzQIzfb3HHLEjZ4YiR/cJiCrZxnAqi+pjeKIEdkwzXRAI7FUhrfPK3SNjaBTEu9GmsugMIA9r3x887Q+ODuC8HH2nzAn7NGpE/e3yiHgWhk0ps5k5DP/2qIdGdONoDzZelrxCl/NWWNUyB93K9F+jC1JX2IMttdY+aQ6zBlw0xnOiNW6Hzy7UtC+xriudjD5APomty7/mYNxLMpRSvWKIjOv/69bDnuC4EL5Kz4jBHLiCyOb+tI0m2qhZ9evAM+Jv1z0NVa8MRtelw/wDa4SzfeespQO/0kjiwfqdfg=="), /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
		},
		SubjectInfo: &SubjectInfo{
			SubjectType:        SUBJECTTYPE_SUBJECT_TYPE_ENTERPRISE.Ptr(),
			FinanceInstitution: wxpay_utility.Bool(true),
			BusinessLicenseInfo: &BusinessLicense{
				LicenseCopy:    wxpay_utility.String("47ZC6GC-vnrbEny__Ie_An5-tCpqxucuxi-vByf3Gjm7KE53JXvGy9tqZm2XAUf-4KGprrKhpVBDIUv0OF4wFNIO4kqg05InE4d2I6_H7I4"),
				LicenseNumber:  wxpay_utility.String("123456789012345678"),
				MerchantName:   wxpay_utility.String("腾讯科技有限公司"),
				LegalPerson:    wxpay_utility.String("张三"),
				LicenseAddress: wxpay_utility.String("广东省深圳市南山区xx路xx号"),
				PeriodBegin:    wxpay_utility.String("2019-08-01"),
				PeriodEnd:      wxpay_utility.String("2029-08-01"),
			},
			CertificateInfo: &CertificateInfo{
				CertCopy:       wxpay_utility.String("0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo"),
				CertType:       CERTIFICATETYPE_CERTIFICATE_TYPE_2388.Ptr(),
				CertNumber:     wxpay_utility.String("111111111111"),
				MerchantName:   wxpay_utility.String("xx公益团体"),
				CompanyAddress: wxpay_utility.String("广东省深圳市南山区xx路xx号"),
				LegalPerson:    wxpay_utility.String("李四"),
				PeriodBegin:    wxpay_utility.String("2019-08-01"),
				PeriodEnd:      wxpay_utility.String("2019-08-01"),
			},
			CertificateLetterCopy: wxpay_utility.String("47ZC6GC-vnrbEny__Ie_An5-tCpqxucuxi-vByf3Gjm7KE53JXvGy9tqZm2XAUf-4KGprrKhpVBDIUv0OF4wFNIO4kqg05InE4d2I6_H7I4"),
			FinanceInstitutionInfo: &FinanceInstitutionInfo{
				FinanceType:        FINANCETYPE_BANK_AGENT.Ptr(),
				FinanceLicensePics: []string{"0P3ng6KTIW4-Q_l2FjmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo"},
			},
			IdentityInfo: &IdentityInfo{
				IdHolderType:        IDHOLDERTYPE_LEGAL.Ptr(),
				IdDocType:           IDENTIFICATIONTYPE_IDENTIFICATION_TYPE_IDCARD.Ptr(),
				AuthorizeLetterCopy: wxpay_utility.String("47ZC6GC-vnrbEny_Ie_An5-tCpqxucuxi-vByf3Gjm7KEIUv0OF4wFNIO4kqg05InE4d2I6_H7I4"),
				IdCardInfo: &IdCardInfo{
					IdCardCopy:      wxpay_utility.String("jTpGmxUX3FBWVQ5NJTZvlKX_gdU4cRz7z5NxpnFuAxhBTEO_PvWkfSCJ3zVIn001D8daLC-ehEuo0BJqRTvDujqhThn4ReFxikqJ5YW6zFQ"),
					IdCardNational:  wxpay_utility.String("47ZC6GC-vnrbEny__Ie_An5-tCpqxucuxi-vByf3Gjm7KE53JXvGy9tqZm2XAUf-4KGprrKhpVBDIUv0OF4wFNIO4kqg05InE4d2I6_H7I4"),
					IdCardName:      wxpay_utility.String("pVd1HJ6zyvPedzGaV+X3qtmrq9bb9tPROvwia4ibL+F6mfjbzQIzfb3HHLEjZ4YiR/cJiCrZxnAqi+pjeKIEdkwzXRAI7FUhrfPK3SNjaBTEu9GmsugMIA9r3x887Q+ODuC8HH2nzAn7NGpE/e3yiHgWhk0ps5k5DP/2qIdGdONoDzZelrxCl/NWWNUyB93K9F+jC1JX2IMttdY+aQ6zBlw0xnOiNW6Hzy7UtC+xriudjD5APomty7/mYNxLMpRSvWKIjOv/69bDnuC4EL5Kz4jBHLiCyOb+tI0m2qhZ9evAM+Jv1z0NVa8MRtelw/wDa4SzfeespQO/0kjiwfqdfg=="), /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
					IdCardNumber:    wxpay_utility.String("AOZdYGISxo4y44/UgZ69bdu9X+tfMUJ9dl+LetjM45/zMbrYu+wWZ8gn4CTdo+D/m9MrPg+V4sm73oxqdQu/hj7aWyDl4GQtPXVdaztB9jVbVZh3QFzV+BEmytMNQp9dt1uWJktlfdDdLR3AMWyMB377xd+m9bSr/ioDTzagEcGe+vLYiKrzcroQv3OR0p3ppFYoQ3IfYeU/04S4t9rNFL+kyblK2FCCqQ11NdbbHoCrJc7NV4oASq6ZFonjTtgjjgKsadIKHXtb3JZKGZjduGdtkRJJp0/0eow96uY1Pk7Rq79Jtt7+I8juwEc4P4TG5xzchG/5IL9DBd+Z0zZXkw=="), /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
					IdCardAddress:   wxpay_utility.String("pVd1HJ6zyvPedzGaV+X3qtmrq9bb9tPROvwia4ibL+F6mfjbzQIzfb3HHLEjZ4YiR/cJiCrZxnAqi+pjeKIEdkwzXRAI7FUhrfPK3SNjaBTEu9GmsugMIA9r3x887Q+ODuC8HH2nzAn7NGpE/e3yiHgWhk0ps5k5DP/2qIdGdONoDzZelrxCl/NWWNUyB93K9F+jC1JX2IMttdY+aQ6zBlw0xnOiNW6Hzy7UtC+xriudjD5APomty7/mYNxLMpRSvWKIjOv/69bDnuC4EL5Kz4jBHLiCyOb+tI0m2qhZ9evAM+Jv1z0NVa8MRtelw/wDa4SzfeespQO/0kjiwfqdfg=="), /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
					CardPeriodBegin: wxpay_utility.String("2026-06-06"),
					CardPeriodEnd:   wxpay_utility.String("2026-06-06"),
				},
				IdDocInfo: &IdDocInfo{
					IdDocCopy:      wxpay_utility.String("jTpGmxUX3FBWVQ5NJTZvlKX_gdU4cRz7z5NxpnFuAxhBTEO_PvWkfSCJ3zVIn001D8daLC-ehEuo0BJqRTvDujqhThn4ReFxikqJ5YW6zFQ"),
					IdDocCopyBack:  wxpay_utility.String("jTpGmxUX3FBWVQ5NJTZvvDujqhThn4ReFxikqJ5YW6zFQ"),
					IdDocName:      wxpay_utility.String("pVd1HJ6zyvPedzGaV+X3qtmrq9bb9tPROvwia4ibL+F6mfjbzQIzfb3HHLEjZ4YiR/cJiCrZxnAqi+pjeKIEdkwzXRAI7FUhrfPK3SNjaBTEu9GmsugMIA9r3x887Q+ODuC8HH2nzAn7NGpE/e3yiHgWhk0ps5k5DP/2qIdGdONoDzZelrxCl/NWWNUyB93K9F+jC1JX2IMttdY+aQ6zBlw0xnOiNW6Hzy7UtC+xriudjD5APomty7/mYNxLMpRSvWKIjOv/69bDnuC4EL5Kz4jBHLiCyOb+tI0m2qhZ9evAM+Jv1z0NVa8MRtelw/wDa4SzfeespQO/0kjiwfqdfg=="), /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
					IdDocNumber:    wxpay_utility.String("AOZdYGISxo4y44/UgZ69bdu9X+tfMUJ9dl+LetjM45/zMbrYu+wWZ8gn4CTdo+D/m9MrPg+V4sm73oxqdQu/hj7aWyDl4GQtPXVdaztB9jVbVZh3QFzV+BEmytMNQp9dt1uWJktlfdDdLR3AMWyMB377xd+m9bSr/ioDTzagEcGe+vLYiKrzcroQv3OR0p3ppFYoQ3IfYeU/04S4t9rNFL+kyblK2FCCqQ11NdbbHoCrJc7NV4oASq6ZFonjTtgjjgKsadIKHXtb3JZKGZjduGdtkRJJp0/0eow96uY1Pk7Rq79Jtt7+I8juwEc4P4TG5xzchG/5IL9DBd+Z0zZXkw=="), /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
					IdDocAddress:   wxpay_utility.String("pVd1HJ6zyvPedzGaV+X3qtmrq9bb9tPROvwia4ibL+F6mfjbzQIzfb3HHLEjZ4YiR/cJiCrZxnAqi+pjeKIEdkwzXRAI7FUhrfPK3SNjaBTEu9GmsugMIA9r3x887Q+ODuC8HH2nzAn7NGpE/e3yiHgWhk0ps5k5DP/2qIdGdONoDzZelrxCl/NWWNUyB93K9F+jC1JX2IMttdY+aQ6zBlw0xnOiNW6Hzy7UtC+xriudjD5APomty7/mYNxLMpRSvWKIjOv/69bDnuC4EL5Kz4jBHLiCyOb+tI0m2qhZ9evAM+Jv1z0NVa8MRtelw/wDa4SzfeespQO/0kjiwfqdfg=="), /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
					DocPeriodBegin: wxpay_utility.String("2019-06-06"),
					DocPeriodEnd:   wxpay_utility.String("2026-06-06"),
				},
				Owner: wxpay_utility.Bool(true),
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
		},
		BusinessInfo: &BusinessInfo{
			MerchantShortname: wxpay_utility.String("张三餐饮店"),
			ServicePhone:      wxpay_utility.String("0758XXXXX"),
			SalesInfo: &SalesInfo{
				SalesScenesType: []SalesScenesType{SALESSCENESTYPE_SALES_SCENES_STORE},
				BizStoreInfo: &StoreInfo{
					BizStoreName:     wxpay_utility.String("大郎烧饼"),
					BizAddressCode:   wxpay_utility.String("440305"),
					BizStoreAddress:  wxpay_utility.String("南山区xx大厦x层xxxx室"),
					StoreEntrancePic: []string{"0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo"},
					IndoorPic:        []string{"0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo"},
					BizSubAppid:      wxpay_utility.String("wx1234567890123456"),
				},
				MpInfo: &MpInfo{
					MpAppid:    wxpay_utility.String("wx1234567890123456"),
					MpSubAppid: wxpay_utility.String("wx1234567890123456"),
					MpPics:     []string{"example_MpPics"},
				},
				MiniProgramInfo: &MiniProgramInfo{
					MiniProgramAppid:    wxpay_utility.String("wx1234567890123456"),
					MiniProgramSubAppid: wxpay_utility.String("wx1234567890123456"),
					MiniProgramPics:     []string{"example_MiniProgramPics"},
				},
				AppInfo: &AppInfo{
					AppAppid:    wxpay_utility.String("wx1234567890123456"),
					AppSubAppid: wxpay_utility.String("wx1234567890123456"),
					AppPics:     []string{"example_AppPics"},
				},
				WebInfo: &WebInfo{
					Domain:           wxpay_utility.String("http://www.qq.com"),
					WebAuthorisation: wxpay_utility.String("47ZC6GC-vnrbEny__Ie_An5-tCpqxucuxi-vByf3Gjm7KE53JXvGy9tqZm2XAUf-4KGprrKhpVBDIUv0OF4wFNIO4kqg05InE4d2I6_H7I4"),
					WebAppid:         wxpay_utility.String("wx1234567890123456"),
				},
				WeworkInfo: &WeworkInfo{
					SubCorpId:  wxpay_utility.String("wx1234567890123456"),
					WeworkPics: []string{"example_WeworkPics"},
				},
			},
		},
		SettlementInfo: &SettlementInfo{
			SettlementId:         wxpay_utility.String("719"),
			QualificationType:    wxpay_utility.String("餐饮"),
			Qualifications:       []string{"example_Qualifications"},
			ActivitiesId:         wxpay_utility.String("716"),
			ActivitiesRate:       wxpay_utility.String("0.6"),
			ActivitiesAdditions:  []string{"example_ActivitiesAdditions"},
			DebitActivitiesRate:  wxpay_utility.String("0.54"),
			CreditActivitiesRate: wxpay_utility.String("0.54"),
		},
		BankAccountInfo: &BankAccountInfo{
			BankAccountType: BANKACCOUNTTYPE_BANK_ACCOUNT_TYPE_CORPORATE.Ptr(),
			AccountName:     wxpay_utility.String("AOZdYGISxo4y44/UgZ69bdu9X+tfMUJ9dl+LetjM45/zMbrYu+wWZ8gn4CTdo+D/m9MrPg+V4sm73oxqdQu/hj7aWyDl4GQtPXVdaztB9jVbVZh3QFzV+BEmytMNQp9dt1uWJktlfdDdLR3AMWyMB377xd+m9bSr/ioDTzagEcGe+vLYiKrzcroQv3OR0p3ppFYoQ3IfYeU/04S4t9rNFL+kyblK2FCCqQ11NdbbHoCrJc7NV4oASq6ZFonjTtgjjgKsadIKHXtb3JZKGZjduGdtkRJJp0/0eow96uY1Pk7Rq79Jtt7+I8juwEc4P4TG5xzchG/5IL9DBd+Z0zZXkw=="), /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
			AccountBank:     wxpay_utility.String("工商银行"),
			BankAddressCode: wxpay_utility.String("110000"),
			BankBranchId:    wxpay_utility.String("402713354941"),
			BankName:        wxpay_utility.String("施秉县农村信用合作联社城关信用社"),
			AccountNumber:   wxpay_utility.String("d+xT+MQCvrLHUVDWv/8MR/dB7TkXM2YYZlokmXzFsWs35NXUot7C0NcxIrUF5FnxqCJHkNgKtxa6RxEYyba1+VBRLnqKG2fSy/Y5qDN08Ej9zHCwJjq52Wg1VG8MRugli9YMI1fI83KGBxhuXyemgS/hqFKsfYGiOkJqjTUpgY5VqjtL2N4l4z11T0ECB/aSyVXUysOFGLVfSrUxMPZy6jWWYGvT1+4P633f+R+ki1gT4WF/2KxZOYmli385ZgVhcR30mr4/G3HBcxi13zp7FnEeOsLlvBmI1PHN4C7Rsu3WL8sPndjXTd75kPkyjqnoMRrEEaYQE8ZRGYoeorwC+w=="), /*请传入 wxpay_utility.EncryptOAEPWithPublicKey 加密结果*/
		},
		AdditionInfo: &AdditionInfo{
			LegalPersonCommitment: wxpay_utility.String("47ZC6GC-vnrbEny__Ie_An5-tCpqxucuxi-vByf3Gjm7KE53JXvGy9tqZm2XAUf-4KGprrKhpVBDIUv0OF4wFNIO4kqg05InE4d2I6_H7I4"),
			LegalPersonVideo:      wxpay_utility.String("47ZC6GC-vnrbEny__Ie_An5-tCpqxucuxi-vByf3Gjm7KE53JXvGy9tqZm2XAUf-4KGprrKhpVBDIUv0OF4wFNIO4kqg05InE4d2I6_H7I4"),
			BusinessAdditionPics:  []string{"example_BusinessAdditionPics"},
			BusinessAdditionMsg:   wxpay_utility.String("特殊情况，说明原因"),
		},
	}

	response, err := Submit(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		return
	}

	fmt.Printf("请求成功: %+v\n", response)
}

func Submit(config *wxpay_utility.MchConfig, request *SubmitReq) (response *SubmitResp, err error) {
	const (
		host   = "https://api.mch.weixin.qq.com"
		method = "POST"
		path   = "/v3/applyment4sub/applyment/"
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
		err = wxpay_utility.ValidateResponse(config.WechatPayPublicKeyId(), config.WechatPayPublicKey(), &httpResponse.Header, respBody)
		if err != nil {
			return nil, err
		}
		response := &SubmitResp{}
		if err := json.Unmarshal(respBody, response); err != nil {
			return nil, err
		}
		return response, nil
	} else {
		return nil, wxpay_utility.NewApiException(httpResponse.StatusCode, httpResponse.Header, respBody)
	}
}

type SubmitReq struct {
	BusinessCode    *string          `json:"business_code,omitempty"`
	ContactInfo     *ContactInfo     `json:"contact_info,omitempty"`
	SubjectInfo     *SubjectInfo     `json:"subject_info,omitempty"`
	BusinessInfo    *BusinessInfo    `json:"business_info,omitempty"`
	SettlementInfo  *SettlementInfo  `json:"settlement_info,omitempty"`
	BankAccountInfo *BankAccountInfo `json:"bank_account_info,omitempty"`
	AdditionInfo    *AdditionInfo    `json:"addition_info,omitempty"`
}
type SubmitResp struct {
	ApplymentId *int64 `json:"applyment_id,omitempty"`
}
type ContactInfo struct {
	ContactType                 *IdHolderType       `json:"contact_type,omitempty"`
	ContactName                 *string             `json:"contact_name,omitempty"`
	ContactIdDocType            *IdentificationType `json:"contact_id_doc_type,omitempty"`
	ContactIdNumber             *string             `json:"contact_id_number,omitempty"`
	ContactIdDocCopy            *string             `json:"contact_id_doc_copy,omitempty"`
	ContactIdDocCopyBack        *string             `json:"contact_id_doc_copy_back,omitempty"`
	ContactPeriodBegin          *string             `json:"contact_period_begin,omitempty"`
	ContactPeriodEnd            *string             `json:"contact_period_end,omitempty"`
	BusinessAuthorizationLetter *string             `json:"business_authorization_letter,omitempty"`
	Openid                      *string             `json:"openid,omitempty"`
	MobilePhone                 *string             `json:"mobile_phone,omitempty"`
	ContactEmail                *string             `json:"contact_email,omitempty"`
}
type SubjectInfo struct {
	SubjectType            *SubjectType            `json:"subject_type,omitempty"`
	FinanceInstitution     *bool                   `json:"finance_institution,omitempty"`
	BusinessLicenseInfo    *BusinessLicense        `json:"business_license_info,omitempty"`
	CertificateInfo        *CertificateInfo        `json:"certificate_info,omitempty"`
	CertificateLetterCopy  *string                 `json:"certificate_letter_copy,omitempty"`
	FinanceInstitutionInfo *FinanceInstitutionInfo `json:"finance_institution_info,omitempty"`
	IdentityInfo           *IdentityInfo           `json:"identity_info,omitempty"`
	UboInfoList            []UboInfoList           `json:"ubo_info_list,omitempty"`
}
type BusinessInfo struct {
	MerchantShortname *string    `json:"merchant_shortname,omitempty"`
	ServicePhone      *string    `json:"service_phone,omitempty"`
	SalesInfo         *SalesInfo `json:"sales_info,omitempty"`
}
type SettlementInfo struct {
	SettlementId         *string  `json:"settlement_id,omitempty"`
	QualificationType    *string  `json:"qualification_type,omitempty"`
	Qualifications       []string `json:"qualifications,omitempty"`
	ActivitiesId         *string  `json:"activities_id,omitempty"`
	ActivitiesRate       *string  `json:"activities_rate,omitempty"`
	ActivitiesAdditions  []string `json:"activities_additions,omitempty"`
	DebitActivitiesRate  *string  `json:"debit_activities_rate,omitempty"`
	CreditActivitiesRate *string  `json:"credit_activities_rate,omitempty"`
}
type BankAccountInfo struct {
	BankAccountType *BankAccountType `json:"bank_account_type,omitempty"`
	AccountName     *string          `json:"account_name,omitempty"`
	AccountBank     *string          `json:"account_bank,omitempty"`
	BankAddressCode *string          `json:"bank_address_code,omitempty"`
	BankBranchId    *string          `json:"bank_branch_id,omitempty"`
	BankName        *string          `json:"bank_name,omitempty"`
	AccountNumber   *string          `json:"account_number,omitempty"`
}
type AdditionInfo struct {
	LegalPersonCommitment *string  `json:"legal_person_commitment,omitempty"`
	LegalPersonVideo      *string  `json:"legal_person_video,omitempty"`
	BusinessAdditionPics  []string `json:"business_addition_pics,omitempty"`
	BusinessAdditionMsg   *string  `json:"business_addition_msg,omitempty"`
}
type IdHolderType string
func (e IdHolderType) Ptr() *IdHolderType { return &e }
const (
	IDHOLDERTYPE_LEGAL IdHolderType = "LEGAL"
	IDHOLDERTYPE_SUPER IdHolderType = "SUPER"
)
type IdentificationType string
func (e IdentificationType) Ptr() *IdentificationType { return &e }
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
func (e SubjectType) Ptr() *SubjectType { return &e }
const (
	SUBJECTTYPE_SUBJECT_TYPE_ENTERPRISE   SubjectType = "SUBJECT_TYPE_ENTERPRISE"
	SUBJECTTYPE_SUBJECT_TYPE_INSTITUTIONS SubjectType = "SUBJECT_TYPE_INSTITUTIONS"
	SUBJECTTYPE_SUBJECT_TYPE_INDIVIDUAL   SubjectType = "SUBJECT_TYPE_INDIVIDUAL"
	SUBJECTTYPE_SUBJECT_TYPE_OTHERS       SubjectType = "SUBJECT_TYPE_OTHERS"
	SUBJECTTYPE_SUBJECT_TYPE_GOVERNMENT   SubjectType = "SUBJECT_TYPE_GOVERNMENT"
)
type BusinessLicense struct {
	LicenseCopy    *string `json:"license_copy,omitempty"`
	LicenseNumber  *string `json:"license_number,omitempty"`
	MerchantName   *string `json:"merchant_name,omitempty"`
	LegalPerson    *string `json:"legal_person,omitempty"`
	LicenseAddress *string `json:"license_address,omitempty"`
	PeriodBegin    *string `json:"period_begin,omitempty"`
	PeriodEnd      *string `json:"period_end,omitempty"`
}
type CertificateInfo struct {
	CertCopy       *string          `json:"cert_copy,omitempty"`
	CertType       *CertificateType `json:"cert_type,omitempty"`
	CertNumber     *string          `json:"cert_number,omitempty"`
	MerchantName   *string          `json:"merchant_name,omitempty"`
	CompanyAddress *string          `json:"company_address,omitempty"`
	LegalPerson    *string          `json:"legal_person,omitempty"`
	PeriodBegin    *string          `json:"period_begin,omitempty"`
	PeriodEnd      *string          `json:"period_end,omitempty"`
}
type FinanceInstitutionInfo struct {
	FinanceType        *FinanceType `json:"finance_type,omitempty"`
	FinanceLicensePics []string     `json:"finance_license_pics,omitempty"`
}
type IdentityInfo struct {
	IdHolderType        *IdHolderType       `json:"id_holder_type,omitempty"`
	IdDocType           *IdentificationType `json:"id_doc_type,omitempty"`
	AuthorizeLetterCopy *string             `json:"authorize_letter_copy,omitempty"`
	IdCardInfo          *IdCardInfo         `json:"id_card_info,omitempty"`
	IdDocInfo           *IdDocInfo          `json:"id_doc_info,omitempty"`
	Owner               *bool               `json:"owner,omitempty"`
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
type SalesInfo struct {
	SalesScenesType []SalesScenesType `json:"sales_scenes_type,omitempty"`
	BizStoreInfo    *StoreInfo        `json:"biz_store_info,omitempty"`
	MpInfo          *MpInfo           `json:"mp_info,omitempty"`
	MiniProgramInfo *MiniProgramInfo  `json:"mini_program_info,omitempty"`
	AppInfo         *AppInfo          `json:"app_info,omitempty"`
	WebInfo         *WebInfo          `json:"web_info,omitempty"`
	WeworkInfo      *WeworkInfo       `json:"wework_info,omitempty"`
}
type BankAccountType string
func (e BankAccountType) Ptr() *BankAccountType { return &e }
const (
	BANKACCOUNTTYPE_BANK_ACCOUNT_TYPE_CORPORATE BankAccountType = "BANK_ACCOUNT_TYPE_CORPORATE"
	BANKACCOUNTTYPE_BANK_ACCOUNT_TYPE_PERSONAL  BankAccountType = "BANK_ACCOUNT_TYPE_PERSONAL"
)
type CertificateType string
func (e CertificateType) Ptr() *CertificateType { return &e }
const (
	CERTIFICATETYPE_CERTIFICATE_TYPE_2388 CertificateType = "CERTIFICATE_TYPE_2388"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2389 CertificateType = "CERTIFICATE_TYPE_2389"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2394 CertificateType = "CERTIFICATE_TYPE_2394"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2395 CertificateType = "CERTIFICATE_TYPE_2395"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2396 CertificateType = "CERTIFICATE_TYPE_2396"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2399 CertificateType = "CERTIFICATE_TYPE_2399"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2400 CertificateType = "CERTIFICATE_TYPE_2400"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2391 CertificateType = "CERTIFICATE_TYPE_2391"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2520 CertificateType = "CERTIFICATE_TYPE_2520"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2521 CertificateType = "CERTIFICATE_TYPE_2521"
	CERTIFICATETYPE_CERTIFICATE_TYPE_2522 CertificateType = "CERTIFICATE_TYPE_2522"
)
type FinanceType string
func (e FinanceType) Ptr() *FinanceType { return &e }
const (
	FINANCETYPE_BANK_AGENT       FinanceType = "BANK_AGENT"
	FINANCETYPE_PAYMENT_AGENT    FinanceType = "PAYMENT_AGENT"
	FINANCETYPE_INSURANCE        FinanceType = "INSURANCE"
	FINANCETYPE_TRADE_AND_SETTLE FinanceType = "TRADE_AND_SETTLE"
	FINANCETYPE_OTHER            FinanceType = "OTHER"
)
type IdCardInfo struct {
	IdCardCopy      *string `json:"id_card_copy,omitempty"`
	IdCardNational  *string `json:"id_card_national,omitempty"`
	IdCardName      *string `json:"id_card_name,omitempty"`
	IdCardNumber    *string `json:"id_card_number,omitempty"`
	IdCardAddress   *string `json:"id_card_address,omitempty"`
	CardPeriodBegin *string `json:"card_period_begin,omitempty"`
	CardPeriodEnd   *string `json:"card_period_end,omitempty"`
}
type IdDocInfo struct {
	IdDocCopy      *string `json:"id_doc_copy,omitempty"`
	IdDocCopyBack  *string `json:"id_doc_copy_back,omitempty"`
	IdDocName      *string `json:"id_doc_name,omitempty"`
	IdDocNumber    *string `json:"id_doc_number,omitempty"`
	IdDocAddress   *string `json:"id_doc_address,omitempty"`
	DocPeriodBegin *string `json:"doc_period_begin,omitempty"`
	DocPeriodEnd   *string `json:"doc_period_end,omitempty"`
}
type SalesScenesType string
func (e SalesScenesType) Ptr() *SalesScenesType { return &e }
const (
	SALESSCENESTYPE_SALES_SCENES_STORE        SalesScenesType = "SALES_SCENES_STORE"
	SALESSCENESTYPE_SALES_SCENES_MP           SalesScenesType = "SALES_SCENES_MP"
	SALESSCENESTYPE_SALES_SCENES_MINI_PROGRAM SalesScenesType = "SALES_SCENES_MINI_PROGRAM"
	SALESSCENESTYPE_SALES_SCENES_WEB          SalesScenesType = "SALES_SCENES_WEB"
	SALESSCENESTYPE_SALES_SCENES_APP          SalesScenesType = "SALES_SCENES_APP"
	SALESSCENESTYPE_SALES_SCENES_WEWORK       SalesScenesType = "SALES_SCENES_WEWORK"
)
type StoreInfo struct {
	BizStoreName     *string  `json:"biz_store_name,omitempty"`
	BizAddressCode   *string  `json:"biz_address_code,omitempty"`
	BizStoreAddress  *string  `json:"biz_store_address,omitempty"`
	StoreEntrancePic []string `json:"store_entrance_pic,omitempty"`
	IndoorPic        []string `json:"indoor_pic,omitempty"`
	BizSubAppid      *string  `json:"biz_sub_appid,omitempty"`
}
type MpInfo struct {
	MpAppid    *string  `json:"mp_appid,omitempty"`
	MpSubAppid *string  `json:"mp_sub_appid,omitempty"`
	MpPics     []string `json:"mp_pics,omitempty"`
}
type MiniProgramInfo struct {
	MiniProgramAppid    *string  `json:"mini_program_appid,omitempty"`
	MiniProgramSubAppid *string  `json:"mini_program_sub_appid,omitempty"`
	MiniProgramPics     []string `json:"mini_program_pics,omitempty"`
}
type AppInfo struct {
	AppAppid    *string  `json:"app_appid,omitempty"`
	AppSubAppid *string  `json:"app_sub_appid,omitempty"`
	AppPics     []string `json:"app_pics,omitempty"`
}
type WebInfo struct {
	Domain           *string `json:"domain,omitempty"`
	WebAuthorisation *string `json:"web_authorisation,omitempty"`
	WebAppid         *string `json:"web_appid,omitempty"`
}
type WeworkInfo struct {
	SubCorpId  *string  `json:"sub_corp_id,omitempty"`
	WeworkPics []string `json:"wework_pics,omitempty"`
}
