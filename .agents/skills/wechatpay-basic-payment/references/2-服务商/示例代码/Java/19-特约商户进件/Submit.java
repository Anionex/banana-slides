package com.java.demo;

import com.java.utils.WXPayUtility; // 引用微信支付工具库，参考：https://pay.weixin.qq.com/doc/v3/partner/4014985777

import com.google.gson.annotations.SerializedName;
import com.google.gson.annotations.Expose;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 提交申请单
 */
public class Submit {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "POST";
  private static String PATH = "/v3/applyment4sub/applyment/";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/partner/4013080340
    Submit client = new Submit(
      "19xxxxxxxx",                    // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考 https://pay.weixin.qq.com/doc/v3/partner/4013080340
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013058924
      "/path/to/apiclient_key.pem",     // 商户API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013038589
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    SubmitReq request = new SubmitReq();
    request.businessCode = "1900013511_10000";
    request.contactInfo = new ContactInfo();
    request.contactInfo.contactType = IdHolderType.LEGAL;
    request.contactInfo.contactName = client.encrypt("contact_name");
    request.contactInfo.contactIdDocType = IdentificationType.IDENTIFICATION_TYPE_IDCARD;
    request.contactInfo.contactIdNumber = client.encrypt("contact_id_number");
    request.contactInfo.contactIdDocCopy = "jTpGmxUXqRTvDujqhThn4ReFxikqJ5YW6zFQ";
    request.contactInfo.contactIdDocCopyBack = "jTpGmxUX3FBWVQ5NJTZvvDujqhThn4ReFxikqJ5YW6zFQ";
    request.contactInfo.contactPeriodBegin = "2019-06-06";
    request.contactInfo.contactPeriodEnd = "2026-06-06";
    request.contactInfo.businessAuthorizationLetter = "47ZC6GC-vnrbEny_Ie_An5-tCpqxucuxi-vByf3Gjm7KEIUv0OF4wFNIO4kqg05InE4d2I6_H7I4";
    request.contactInfo.openid = "pVd1HJ6zyvPedzGaV+X3qtmrq9bb9tPROvwia4ibL+F6mfjbzQIzfb3HHLEjZ4YiR/cJiCrZxnAqi+pjeKIEdkwzXRAI7FUhrfPK3SNjaBTEu9GmsugMIA9r3x887Q+ODuC8HH2nzAn7NGpE/e3yiHgWhk0ps5k5DP/2qIdGdONoDzZelrxCl/NWWNUyB93K9F+jC1JX2IMttdY+aQ6zBlw0xnOiNW6Hzy7UtC+xriudjD5APomty7/mYNxLMpRSvWKIjOv/69bDnuC4EL5Kz4jBHLiCyOb+tI0m2qhZ9evAM+Jv1z0NVa8MRtelw/wDa4SzfeespQO/0kjiwfqdfg== 字段加密: 使用APIv3定义的方式加密";
    request.contactInfo.mobilePhone = client.encrypt("mobile_phone");
    request.contactInfo.contactEmail = client.encrypt("contact_email");
    request.subjectInfo = new SubjectInfo();
    request.subjectInfo.subjectType = SubjectType.SUBJECT_TYPE_ENTERPRISE;
    request.subjectInfo.financeInstitution = true;
    request.subjectInfo.businessLicenseInfo = new BusinessLicense();
    request.subjectInfo.businessLicenseInfo.licenseCopy = "47ZC6GC-vnrbEny__Ie_An5-tCpqxucuxi-vByf3Gjm7KE53JXvGy9tqZm2XAUf-4KGprrKhpVBDIUv0OF4wFNIO4kqg05InE4d2I6_H7I4";
    request.subjectInfo.businessLicenseInfo.licenseNumber = "123456789012345678";
    request.subjectInfo.businessLicenseInfo.merchantName = "腾讯科技有限公司";
    request.subjectInfo.businessLicenseInfo.legalPerson = "张三";
    request.subjectInfo.businessLicenseInfo.licenseAddress = "广东省深圳市南山区xx路xx号";
    request.subjectInfo.businessLicenseInfo.periodBegin = "2019-08-01";
    request.subjectInfo.businessLicenseInfo.periodEnd = "2029-08-01";
    request.subjectInfo.certificateInfo = new CertificateInfo();
    request.subjectInfo.certificateInfo.certCopy = "0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo";
    request.subjectInfo.certificateInfo.certType = CertificateType.CERTIFICATE_TYPE_2388;
    request.subjectInfo.certificateInfo.certNumber = "111111111111";
    request.subjectInfo.certificateInfo.merchantName = "xx公益团体";
    request.subjectInfo.certificateInfo.companyAddress = "广东省深圳市南山区xx路xx号";
    request.subjectInfo.certificateInfo.legalPerson = "李四";
    request.subjectInfo.certificateInfo.periodBegin = "2019-08-01";
    request.subjectInfo.certificateInfo.periodEnd = "2019-08-01";
    request.subjectInfo.certificateLetterCopy = "47ZC6GC-vnrbEny__Ie_An5-tCpqxucuxi-vByf3Gjm7KE53JXvGy9tqZm2XAUf-4KGprrKhpVBDIUv0OF4wFNIO4kqg05InE4d2I6_H7I4";
    request.subjectInfo.financeInstitutionInfo = new FinanceInstitutionInfo();
    request.subjectInfo.financeInstitutionInfo.financeType = FinanceType.BANK_AGENT;
    request.subjectInfo.financeInstitutionInfo.financeLicensePics = new ArrayList<>();
    {
      request.subjectInfo.financeInstitutionInfo.financeLicensePics.add("0P3ng6KTIW4-Q_l2FjmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo");
    };
    request.subjectInfo.identityInfo = new IdentityInfo();
    request.subjectInfo.identityInfo.idHolderType = IdHolderType.LEGAL;
    request.subjectInfo.identityInfo.idDocType = IdentificationType.IDENTIFICATION_TYPE_IDCARD;
    request.subjectInfo.identityInfo.authorizeLetterCopy = "47ZC6GC-vnrbEny_Ie_An5-tCpqxucuxi-vByf3Gjm7KEIUv0OF4wFNIO4kqg05InE4d2I6_H7I4";
    request.subjectInfo.identityInfo.idCardInfo = new IdCardInfo();
    request.subjectInfo.identityInfo.idCardInfo.idCardCopy = "jTpGmxUX3FBWVQ5NJTZvlKX_gdU4cRz7z5NxpnFuAxhBTEO_PvWkfSCJ3zVIn001D8daLC-ehEuo0BJqRTvDujqhThn4ReFxikqJ5YW6zFQ";
    request.subjectInfo.identityInfo.idCardInfo.idCardNational = "47ZC6GC-vnrbEny__Ie_An5-tCpqxucuxi-vByf3Gjm7KE53JXvGy9tqZm2XAUf-4KGprrKhpVBDIUv0OF4wFNIO4kqg05InE4d2I6_H7I4";
    request.subjectInfo.identityInfo.idCardInfo.idCardName = client.encrypt("id_card_name");
    request.subjectInfo.identityInfo.idCardInfo.idCardNumber = client.encrypt("id_card_number");
    request.subjectInfo.identityInfo.idCardInfo.idCardAddress = client.encrypt("id_card_address");
    request.subjectInfo.identityInfo.idCardInfo.cardPeriodBegin = "2026-06-06";
    request.subjectInfo.identityInfo.idCardInfo.cardPeriodEnd = "2026-06-06";
    request.subjectInfo.identityInfo.idDocInfo = new IdDocInfo();
    request.subjectInfo.identityInfo.idDocInfo.idDocCopy = "jTpGmxUX3FBWVQ5NJTZvlKX_gdU4cRz7z5NxpnFuAxhBTEO_PvWkfSCJ3zVIn001D8daLC-ehEuo0BJqRTvDujqhThn4ReFxikqJ5YW6zFQ";
    request.subjectInfo.identityInfo.idDocInfo.idDocCopyBack = "jTpGmxUX3FBWVQ5NJTZvvDujqhThn4ReFxikqJ5YW6zFQ";
    request.subjectInfo.identityInfo.idDocInfo.idDocName = client.encrypt("id_doc_name");
    request.subjectInfo.identityInfo.idDocInfo.idDocNumber = client.encrypt("id_doc_number");
    request.subjectInfo.identityInfo.idDocInfo.idDocAddress = client.encrypt("id_doc_address");
    request.subjectInfo.identityInfo.idDocInfo.docPeriodBegin = "2019-06-06";
    request.subjectInfo.identityInfo.idDocInfo.docPeriodEnd = "2026-06-06";
    request.subjectInfo.identityInfo.owner = true;
    request.subjectInfo.uboInfoList = new ArrayList<>();
    {
      UBOInfoList uboInfoListItem = new UBOInfoList();
      uboInfoListItem.uboIdDocType = IdentificationType.IDENTIFICATION_TYPE_IDCARD;
      uboInfoListItem.uboIdDocCopy = "jTpGmxUXqRTvDujqhThn4ReFxikqJ5YW6zFQ";
      uboInfoListItem.uboIdDocCopyBack = "jTpGmxUX3FBWVQ5NJTZvvDujqhThn4ReFxikqJ5YW6zFQ";
      uboInfoListItem.uboIdDocName = client.encrypt("ubo_id_doc_name");
      uboInfoListItem.uboIdDocNumber = client.encrypt("ubo_id_doc_number");
      uboInfoListItem.uboIdDocAddress = client.encrypt("ubo_id_doc_address");
      uboInfoListItem.uboPeriodBegin = "2019-06-06";
      uboInfoListItem.uboPeriodEnd = "2026-06-06";
      request.subjectInfo.uboInfoList.add(uboInfoListItem);
    };
    request.businessInfo = new BusinessInfo();
    request.businessInfo.merchantShortname = "张三餐饮店";
    request.businessInfo.servicePhone = "0758XXXXX";
    request.businessInfo.salesInfo = new SalesInfo();
    request.businessInfo.salesInfo.salesScenesType = new ArrayList<>();
    {
      request.businessInfo.salesInfo.salesScenesType.add(SalesScenesType.SALES_SCENES_STORE);
    };
    request.businessInfo.salesInfo.bizStoreInfo = new StoreInfo();
    request.businessInfo.salesInfo.bizStoreInfo.bizStoreName = "大郎烧饼";
    request.businessInfo.salesInfo.bizStoreInfo.bizAddressCode = "440305";
    request.businessInfo.salesInfo.bizStoreInfo.bizStoreAddress = "南山区xx大厦x层xxxx室";
    request.businessInfo.salesInfo.bizStoreInfo.storeEntrancePic = new ArrayList<>();
    {
      request.businessInfo.salesInfo.bizStoreInfo.storeEntrancePic.add("0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo");
    };
    request.businessInfo.salesInfo.bizStoreInfo.indoorPic = new ArrayList<>();
    {
      request.businessInfo.salesInfo.bizStoreInfo.indoorPic.add("0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo");
    };
    request.businessInfo.salesInfo.bizStoreInfo.bizSubAppid = "wx1234567890123456";
    request.businessInfo.salesInfo.mpInfo = new MpInfo();
    request.businessInfo.salesInfo.mpInfo.mpAppid = "wx1234567890123456";
    request.businessInfo.salesInfo.mpInfo.mpSubAppid = "wx1234567890123456";
    request.businessInfo.salesInfo.mpInfo.mpPics = new ArrayList<>();
    {
      request.businessInfo.salesInfo.mpInfo.mpPics.add("example_mpPics");
    };
    request.businessInfo.salesInfo.miniProgramInfo = new MiniProgramInfo();
    request.businessInfo.salesInfo.miniProgramInfo.miniProgramAppid = "wx1234567890123456";
    request.businessInfo.salesInfo.miniProgramInfo.miniProgramSubAppid = "wx1234567890123456";
    request.businessInfo.salesInfo.miniProgramInfo.miniProgramPics = new ArrayList<>();
    {
      request.businessInfo.salesInfo.miniProgramInfo.miniProgramPics.add("example_miniProgramPics");
    };
    request.businessInfo.salesInfo.appInfo = new AppInfo();
    request.businessInfo.salesInfo.appInfo.appAppid = "wx1234567890123456";
    request.businessInfo.salesInfo.appInfo.appSubAppid = "wx1234567890123456";
    request.businessInfo.salesInfo.appInfo.appPics = new ArrayList<>();
    {
      request.businessInfo.salesInfo.appInfo.appPics.add("example_appPics");
    };
    request.businessInfo.salesInfo.webInfo = new WebInfo();
    request.businessInfo.salesInfo.webInfo.domain = "http://www.qq.com";
    request.businessInfo.salesInfo.webInfo.webAuthorisation = "47ZC6GC-vnrbEny__Ie_An5-tCpqxucuxi-vByf3Gjm7KE53JXvGy9tqZm2XAUf-4KGprrKhpVBDIUv0OF4wFNIO4kqg05InE4d2I6_H7I4";
    request.businessInfo.salesInfo.webInfo.webAppid = "wx1234567890123456";
    request.businessInfo.salesInfo.weworkInfo = new WeworkInfo();
    request.businessInfo.salesInfo.weworkInfo.subCorpId = "wx1234567890123456";
    request.businessInfo.salesInfo.weworkInfo.weworkPics = new ArrayList<>();
    {
      request.businessInfo.salesInfo.weworkInfo.weworkPics.add("example_weworkPics");
    };
    request.settlementInfo = new SettlementInfo();
    request.settlementInfo.settlementId = "719";
    request.settlementInfo.qualificationType = "餐饮";
    request.settlementInfo.qualifications = new ArrayList<>();
    {
      request.settlementInfo.qualifications.add("example_qualifications");
    };
    request.settlementInfo.activitiesId = "716";
    request.settlementInfo.activitiesRate = "0.6";
    request.settlementInfo.activitiesAdditions = new ArrayList<>();
    {
      request.settlementInfo.activitiesAdditions.add("example_activitiesAdditions");
    };
    request.settlementInfo.debitActivitiesRate = "0.54";
    request.settlementInfo.creditActivitiesRate = "0.54";
    request.bankAccountInfo = new BankAccountInfo();
    request.bankAccountInfo.bankAccountType = BankAccountType.BANK_ACCOUNT_TYPE_CORPORATE;
    request.bankAccountInfo.accountName = client.encrypt("account_name");
    request.bankAccountInfo.accountBank = "工商银行";
    request.bankAccountInfo.bankAddressCode = "110000";
    request.bankAccountInfo.bankBranchId = "402713354941";
    request.bankAccountInfo.bankName = "施秉县农村信用合作联社城关信用社";
    request.bankAccountInfo.accountNumber = client.encrypt("account_number");
    request.additionInfo = new AdditionInfo();
    request.additionInfo.legalPersonCommitment = "47ZC6GC-vnrbEny__Ie_An5-tCpqxucuxi-vByf3Gjm7KE53JXvGy9tqZm2XAUf-4KGprrKhpVBDIUv0OF4wFNIO4kqg05InE4d2I6_H7I4";
    request.additionInfo.legalPersonVideo = "47ZC6GC-vnrbEny__Ie_An5-tCpqxucuxi-vByf3Gjm7KE53JXvGy9tqZm2XAUf-4KGprrKhpVBDIUv0OF4wFNIO4kqg05InE4d2I6_H7I4";
    request.additionInfo.businessAdditionPics = new ArrayList<>();
    {
      request.additionInfo.businessAdditionPics.add("example_businessAdditionPics");
    };
    request.additionInfo.businessAdditionMsg = "特殊情况，说明原因";
    try {
      SubmitResp response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public SubmitResp run(SubmitReq request) {
    String uri = PATH;
    String reqBody = WXPayUtility.toJson(request);

    Request.Builder reqBuilder = new Request.Builder().url(HOST + uri);
    reqBuilder.addHeader("Accept", "application/json");
    reqBuilder.addHeader("Wechatpay-Serial", wechatPayPublicKeyId);
    reqBuilder.addHeader("Authorization", WXPayUtility.buildAuthorization(mchid, certificateSerialNo,privateKey, METHOD, uri, reqBody));
    reqBuilder.addHeader("Content-Type", "application/json");
    RequestBody requestBody = RequestBody.create(MediaType.parse("application/json; charset=utf-8"), reqBody);
    reqBuilder.method(METHOD, requestBody);
    Request httpRequest = reqBuilder.build();

    OkHttpClient client = new OkHttpClient.Builder().build();
    try (Response httpResponse = client.newCall(httpRequest).execute()) {
      String respBody = WXPayUtility.extractBody(httpResponse);
      if (httpResponse.code() >= 200 && httpResponse.code() < 300) {
        WXPayUtility.validateResponse(this.wechatPayPublicKeyId, this.wechatPayPublicKey,
            httpResponse.headers(), respBody);
        return WXPayUtility.fromJson(respBody, SubmitResp.class);
      } else {
        throw new WXPayUtility.ApiException(httpResponse.code(), respBody, httpResponse.headers());
      }
    } catch (IOException e) {
      throw new UncheckedIOException("Sending request to " + uri + " failed.", e);
    }
  }

  private final String mchid;
  private final String certificateSerialNo;
  private final PrivateKey privateKey;
  private final String wechatPayPublicKeyId;
  private final PublicKey wechatPayPublicKey;

  public Submit(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public String encrypt(String plainText) {
    return WXPayUtility.encrypt(this.wechatPayPublicKey, plainText);
  }

  public static class SubmitReq {
    @SerializedName("business_code")
    public String businessCode;
    @SerializedName("contact_info")
    public ContactInfo contactInfo;
    @SerializedName("subject_info")
    public SubjectInfo subjectInfo;
    @SerializedName("business_info")
    public BusinessInfo businessInfo;
    @SerializedName("settlement_info")
    public SettlementInfo settlementInfo;
    @SerializedName("bank_account_info")
    public BankAccountInfo bankAccountInfo;
    @SerializedName("addition_info")
    public AdditionInfo additionInfo;
  }

  public static class SubmitResp {
    @SerializedName("applyment_id")
    public Long applymentId;
  }

  public static class ContactInfo {
    @SerializedName("contact_type") public IdHolderType contactType;
    @SerializedName("contact_name") public String contactName;
    @SerializedName("contact_id_doc_type") public IdentificationType contactIdDocType;
    @SerializedName("contact_id_number") public String contactIdNumber;
    @SerializedName("contact_id_doc_copy") public String contactIdDocCopy;
    @SerializedName("contact_id_doc_copy_back") public String contactIdDocCopyBack;
    @SerializedName("contact_period_begin") public String contactPeriodBegin;
    @SerializedName("contact_period_end") public String contactPeriodEnd;
    @SerializedName("business_authorization_letter") public String businessAuthorizationLetter;
    @SerializedName("openid") public String openid;
    @SerializedName("mobile_phone") public String mobilePhone;
    @SerializedName("contact_email") public String contactEmail;
  }

  public static class SubjectInfo {
    @SerializedName("subject_type") public SubjectType subjectType;
    @SerializedName("finance_institution") public Boolean financeInstitution;
    @SerializedName("business_license_info") public BusinessLicense businessLicenseInfo;
    @SerializedName("certificate_info") public CertificateInfo certificateInfo;
    @SerializedName("certificate_letter_copy") public String certificateLetterCopy;
    @SerializedName("finance_institution_info") public FinanceInstitutionInfo financeInstitutionInfo;
    @SerializedName("identity_info") public IdentityInfo identityInfo;
    @SerializedName("ubo_info_list") public List<UBOInfoList> uboInfoList;
  }

  public static class BusinessInfo {
    @SerializedName("merchant_shortname") public String merchantShortname;
    @SerializedName("service_phone") public String servicePhone;
    @SerializedName("sales_info") public SalesInfo salesInfo;
  }

  public static class SettlementInfo {
    @SerializedName("settlement_id") public String settlementId;
    @SerializedName("qualification_type") public String qualificationType;
    @SerializedName("qualifications") public List<String> qualifications;
    @SerializedName("activities_id") public String activitiesId;
    @SerializedName("activities_rate") public String activitiesRate;
    @SerializedName("activities_additions") public List<String> activitiesAdditions;
    @SerializedName("debit_activities_rate") public String debitActivitiesRate;
    @SerializedName("credit_activities_rate") public String creditActivitiesRate;
  }

  public static class BankAccountInfo {
    @SerializedName("bank_account_type") public BankAccountType bankAccountType;
    @SerializedName("account_name") public String accountName;
    @SerializedName("account_bank") public String accountBank;
    @SerializedName("bank_address_code") public String bankAddressCode;
    @SerializedName("bank_branch_id") public String bankBranchId;
    @SerializedName("bank_name") public String bankName;
    @SerializedName("account_number") public String accountNumber;
  }

  public static class AdditionInfo {
    @SerializedName("legal_person_commitment") public String legalPersonCommitment;
    @SerializedName("legal_person_video") public String legalPersonVideo;
    @SerializedName("business_addition_pics") public List<String> businessAdditionPics;
    @SerializedName("business_addition_msg") public String businessAdditionMsg;
  }

  public enum IdHolderType {
    @SerializedName("LEGAL") LEGAL,
    @SerializedName("SUPER") SUPER
  }

  public enum IdentificationType {
    @SerializedName("IDENTIFICATION_TYPE_IDCARD") IDENTIFICATION_TYPE_IDCARD,
    @SerializedName("IDENTIFICATION_TYPE_OVERSEA_PASSPORT") IDENTIFICATION_TYPE_OVERSEA_PASSPORT,
    @SerializedName("IDENTIFICATION_TYPE_HONGKONG_PASSPORT") IDENTIFICATION_TYPE_HONGKONG_PASSPORT,
    @SerializedName("IDENTIFICATION_TYPE_MACAO_PASSPORT") IDENTIFICATION_TYPE_MACAO_PASSPORT,
    @SerializedName("IDENTIFICATION_TYPE_TAIWAN_PASSPORT") IDENTIFICATION_TYPE_TAIWAN_PASSPORT,
    @SerializedName("IDENTIFICATION_TYPE_FOREIGN_RESIDENT") IDENTIFICATION_TYPE_FOREIGN_RESIDENT,
    @SerializedName("IDENTIFICATION_TYPE_HONGKONG_MACAO_RESIDENT") IDENTIFICATION_TYPE_HONGKONG_MACAO_RESIDENT,
    @SerializedName("IDENTIFICATION_TYPE_TAIWAN_RESIDENT") IDENTIFICATION_TYPE_TAIWAN_RESIDENT
  }

  public enum SubjectType {
    @SerializedName("SUBJECT_TYPE_ENTERPRISE") SUBJECT_TYPE_ENTERPRISE,
    @SerializedName("SUBJECT_TYPE_INSTITUTIONS") SUBJECT_TYPE_INSTITUTIONS,
    @SerializedName("SUBJECT_TYPE_INDIVIDUAL") SUBJECT_TYPE_INDIVIDUAL,
    @SerializedName("SUBJECT_TYPE_OTHERS") SUBJECT_TYPE_OTHERS,
    @SerializedName("SUBJECT_TYPE_GOVERNMENT") SUBJECT_TYPE_GOVERNMENT
  }

  public static class BusinessLicense {
    @SerializedName("license_copy") public String licenseCopy;
    @SerializedName("license_number") public String licenseNumber;
    @SerializedName("merchant_name") public String merchantName;
    @SerializedName("legal_person") public String legalPerson;
    @SerializedName("license_address") public String licenseAddress;
    @SerializedName("period_begin") public String periodBegin;
    @SerializedName("period_end") public String periodEnd;
  }

  public static class CertificateInfo {
    @SerializedName("cert_copy") public String certCopy;
    @SerializedName("cert_type") public CertificateType certType;
    @SerializedName("cert_number") public String certNumber;
    @SerializedName("merchant_name") public String merchantName;
    @SerializedName("company_address") public String companyAddress;
    @SerializedName("legal_person") public String legalPerson;
    @SerializedName("period_begin") public String periodBegin;
    @SerializedName("period_end") public String periodEnd;
  }

  public static class FinanceInstitutionInfo {
    @SerializedName("finance_type") public FinanceType financeType;
    @SerializedName("finance_license_pics") public List<String> financeLicensePics;
  }

  public static class IdentityInfo {
    @SerializedName("id_holder_type") public IdHolderType idHolderType;
    @SerializedName("id_doc_type") public IdentificationType idDocType;
    @SerializedName("authorize_letter_copy") public String authorizeLetterCopy;
    @SerializedName("id_card_info") public IdCardInfo idCardInfo;
    @SerializedName("id_doc_info") public IdDocInfo idDocInfo;
    @SerializedName("owner") public Boolean owner;
  }

  public static class UBOInfoList {
    @SerializedName("ubo_id_doc_type") public IdentificationType uboIdDocType;
    @SerializedName("ubo_id_doc_copy") public String uboIdDocCopy;
    @SerializedName("ubo_id_doc_copy_back") public String uboIdDocCopyBack;
    @SerializedName("ubo_id_doc_name") public String uboIdDocName;
    @SerializedName("ubo_id_doc_number") public String uboIdDocNumber;
    @SerializedName("ubo_id_doc_address") public String uboIdDocAddress;
    @SerializedName("ubo_period_begin") public String uboPeriodBegin;
    @SerializedName("ubo_period_end") public String uboPeriodEnd;
  }

  public static class SalesInfo {
    @SerializedName("sales_scenes_type") public List<SalesScenesType> salesScenesType = new ArrayList<>();
    @SerializedName("biz_store_info") public StoreInfo bizStoreInfo;
    @SerializedName("mp_info") public MpInfo mpInfo;
    @SerializedName("mini_program_info") public MiniProgramInfo miniProgramInfo;
    @SerializedName("app_info") public AppInfo appInfo;
    @SerializedName("web_info") public WebInfo webInfo;
    @SerializedName("wework_info") public WeworkInfo weworkInfo;
  }

  public enum BankAccountType {
    @SerializedName("BANK_ACCOUNT_TYPE_CORPORATE") BANK_ACCOUNT_TYPE_CORPORATE,
    @SerializedName("BANK_ACCOUNT_TYPE_PERSONAL") BANK_ACCOUNT_TYPE_PERSONAL
  }

  public enum CertificateType {
    @SerializedName("CERTIFICATE_TYPE_2388") CERTIFICATE_TYPE_2388,
    @SerializedName("CERTIFICATE_TYPE_2389") CERTIFICATE_TYPE_2389,
    @SerializedName("CERTIFICATE_TYPE_2394") CERTIFICATE_TYPE_2394,
    @SerializedName("CERTIFICATE_TYPE_2395") CERTIFICATE_TYPE_2395,
    @SerializedName("CERTIFICATE_TYPE_2396") CERTIFICATE_TYPE_2396,
    @SerializedName("CERTIFICATE_TYPE_2399") CERTIFICATE_TYPE_2399,
    @SerializedName("CERTIFICATE_TYPE_2400") CERTIFICATE_TYPE_2400,
    @SerializedName("CERTIFICATE_TYPE_2391") CERTIFICATE_TYPE_2391,
    @SerializedName("CERTIFICATE_TYPE_2520") CERTIFICATE_TYPE_2520,
    @SerializedName("CERTIFICATE_TYPE_2521") CERTIFICATE_TYPE_2521,
    @SerializedName("CERTIFICATE_TYPE_2522") CERTIFICATE_TYPE_2522
  }

  public enum FinanceType {
    @SerializedName("BANK_AGENT") BANK_AGENT,
    @SerializedName("PAYMENT_AGENT") PAYMENT_AGENT,
    @SerializedName("INSURANCE") INSURANCE,
    @SerializedName("TRADE_AND_SETTLE") TRADE_AND_SETTLE,
    @SerializedName("OTHER") OTHER
  }

  public static class IdCardInfo {
    @SerializedName("id_card_copy") public String idCardCopy;
    @SerializedName("id_card_national") public String idCardNational;
    @SerializedName("id_card_name") public String idCardName;
    @SerializedName("id_card_number") public String idCardNumber;
    @SerializedName("id_card_address") public String idCardAddress;
    @SerializedName("card_period_begin") public String cardPeriodBegin;
    @SerializedName("card_period_end") public String cardPeriodEnd;
  }

  public static class IdDocInfo {
    @SerializedName("id_doc_copy") public String idDocCopy;
    @SerializedName("id_doc_copy_back") public String idDocCopyBack;
    @SerializedName("id_doc_name") public String idDocName;
    @SerializedName("id_doc_number") public String idDocNumber;
    @SerializedName("id_doc_address") public String idDocAddress;
    @SerializedName("doc_period_begin") public String docPeriodBegin;
    @SerializedName("doc_period_end") public String docPeriodEnd;
  }

  public enum SalesScenesType {
    @SerializedName("SALES_SCENES_STORE") SALES_SCENES_STORE,
    @SerializedName("SALES_SCENES_MP") SALES_SCENES_MP,
    @SerializedName("SALES_SCENES_MINI_PROGRAM") SALES_SCENES_MINI_PROGRAM,
    @SerializedName("SALES_SCENES_WEB") SALES_SCENES_WEB,
    @SerializedName("SALES_SCENES_APP") SALES_SCENES_APP,
    @SerializedName("SALES_SCENES_WEWORK") SALES_SCENES_WEWORK
  }

  public static class StoreInfo {
    @SerializedName("biz_store_name") public String bizStoreName;
    @SerializedName("biz_address_code") public String bizAddressCode;
    @SerializedName("biz_store_address") public String bizStoreAddress;
    @SerializedName("store_entrance_pic") public List<String> storeEntrancePic;
    @SerializedName("indoor_pic") public List<String> indoorPic;
    @SerializedName("biz_sub_appid") public String bizSubAppid;
  }

  public static class MpInfo {
    @SerializedName("mp_appid") public String mpAppid;
    @SerializedName("mp_sub_appid") public String mpSubAppid;
    @SerializedName("mp_pics") public List<String> mpPics;
  }

  public static class MiniProgramInfo {
    @SerializedName("mini_program_appid") public String miniProgramAppid;
    @SerializedName("mini_program_sub_appid") public String miniProgramSubAppid;
    @SerializedName("mini_program_pics") public List<String> miniProgramPics;
  }

  public static class AppInfo {
    @SerializedName("app_appid") public String appAppid;
    @SerializedName("app_sub_appid") public String appSubAppid;
    @SerializedName("app_pics") public List<String> appPics;
  }

  public static class WebInfo {
    @SerializedName("domain") public String domain;
    @SerializedName("web_authorisation") public String webAuthorisation;
    @SerializedName("web_appid") public String webAppid;
  }

  public static class WeworkInfo {
    @SerializedName("sub_corp_id") public String subCorpId;
    @SerializedName("wework_pics") public List<String> weworkPics;
  }
}
