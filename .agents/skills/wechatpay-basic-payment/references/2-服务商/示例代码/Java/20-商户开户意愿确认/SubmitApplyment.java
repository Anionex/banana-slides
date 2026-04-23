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
public class SubmitApplyment {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "POST";
  private static String PATH = "/v3/apply4subject/applyment";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/partner/4013080340
    SubmitApplyment client = new SubmitApplyment(
      "19xxxxxxxx",                    // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考 https://pay.weixin.qq.com/doc/v3/partner/4013080340
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013058924
      "/path/to/apiclient_key.pem",     // 商户API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013038589
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    SubmitApplymentRequest request = new SubmitApplymentRequest();
    request.channelId = "20001111";
    request.businessCode = "1900013511_10000";
    request.contactInfo = new ContactInfo();
    request.contactInfo.name = client.encrypt("name");
    request.contactInfo.mobile = client.encrypt("mobile");
    request.contactInfo.idCardNumber = client.encrypt("id_card_number");
    request.contactInfo.contactType = IdHolderType.LEGAL;
    request.contactInfo.contactIdDocType = IdentificationType.IDENTIFICATION_TYPE_IDCARD;
    request.contactInfo.contactIdDocCopy = "jTpGmxUXqRTvDujqhThn4ReFxikqJ5YW6zFQ";
    request.contactInfo.contactIdDocCopyBack = "jTpGmxUX3FBWVQ5NJTZvvDujqhThn4ReFxikqJ5YW6zFQ";
    request.contactInfo.contactPeriodBegin = "2019-06-06";
    request.contactInfo.contactPeriodEnd = "2026-06-06";
    request.subjectInfo = new SubjectInfo();
    request.subjectInfo.subjectType = SubjectType.SUBJECT_TYPE_ENTERPRISE;
    request.subjectInfo.isFinanceInstitution = false;
    request.subjectInfo.businessLicenceInfo = new BusinessLicenceInfo();
    request.subjectInfo.businessLicenceInfo.licenceNumber = "914201123033363296";
    request.subjectInfo.businessLicenceInfo.licenceCopy = "0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo";
    request.subjectInfo.businessLicenceInfo.merchantName = "李四网络有限公司";
    request.subjectInfo.businessLicenceInfo.legalPerson = "李四";
    request.subjectInfo.businessLicenceInfo.companyAddress = "广东省深圳市南山区xx路xx号";
    request.subjectInfo.businessLicenceInfo.licenceValidDate = "[\\\"2017-10-28\\\",\\\"2037-10-28\\\"]";
    request.subjectInfo.certificateInfo = new CertificateInfo();
    request.subjectInfo.certificateInfo.certType = CertificateType.CERTIFICATE_TYPE_2388;
    request.subjectInfo.certificateInfo.certNumber = "111111111111";
    request.subjectInfo.certificateInfo.certCopy = "0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo";
    request.subjectInfo.certificateInfo.merchantName = "xx公益团体";
    request.subjectInfo.certificateInfo.legalPerson = "李四";
    request.subjectInfo.certificateInfo.companyAddress = "广东省深圳市南山区xx路xx号";
    request.subjectInfo.certificateInfo.certValidDate = "[\\\"2017-10-28\\\",\\\"2037-10-28\\\"]";
    request.subjectInfo.companyProveCopy = "0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo";
    request.subjectInfo.assistProveInfo = new AssitProveInfo();
    request.subjectInfo.assistProveInfo.microBizType = MicroBizType.MICRO_TYPE_STORE;
    request.subjectInfo.assistProveInfo.storeName = "大郎烧饼";
    request.subjectInfo.assistProveInfo.storeAddressCode = "440305";
    request.subjectInfo.assistProveInfo.storeAddress = "广东省深圳市南山区xx大厦x层xxxx室";
    request.subjectInfo.assistProveInfo.storeHeaderCopy = "0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo";
    request.subjectInfo.assistProveInfo.storeIndoorCopy = "0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo";
    request.subjectInfo.specialOperationList = new ArrayList<>();
    {
      SpecialOperation specialOperationListItem = new SpecialOperation();
      specialOperationListItem.categoryId = 100L;
      specialOperationListItem.operationCopyList = new ArrayList<>();
      {
        specialOperationListItem.operationCopyList.add("0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo");
      };
      request.subjectInfo.specialOperationList.add(specialOperationListItem);
    };
    request.subjectInfo.financeInstitutionInfo = new FinanceInstitutionInfo();
    request.subjectInfo.financeInstitutionInfo.financeType = FinanceType.BANK_AGENT;
    request.subjectInfo.financeInstitutionInfo.financeLicensePics = new ArrayList<>();
    {
      request.subjectInfo.financeInstitutionInfo.financeLicensePics.add("0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo");
    };
    request.identificationInfo = new IdentificationInfo();
    request.identificationInfo.idHolderType = IdHolderType.LEGAL;
    request.identificationInfo.identificationType = IdentificationType.IDENTIFICATION_TYPE_IDCARD;
    request.identificationInfo.identificationName = client.encrypt("identification_name");
    request.identificationInfo.identificationNumber = client.encrypt("identification_number");
    request.identificationInfo.identificationValidDate = "[\\\"2017-10-28\\\",\\\"2037-10-28\\\"]";
    request.identificationInfo.identificationFrontCopy = "0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo";
    request.identificationInfo.identificationBackCopy = "0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo";
    request.identificationInfo.authorizeLetterCopy = "0P3ng6KTIW4-Q_l2FjKLZuhHjBWoMAjmVtCz7ScmhEIThCaV-4BBgVwtNkCHO_XXqK5dE5YdOmFJBZR9FwczhJehHhAZN6BKXQPcs-VvdSo";
    request.identificationInfo.owner = false;
    request.identificationInfo.identificationAddress = client.encrypt("identification_address");
    request.uboInfo = new UBOInfo();
    request.uboInfo.uboIdType = IdentificationType.IDENTIFICATION_TYPE_IDCARD;
    request.uboInfo.uboIdCardCopy = "jTpGmxUX3FBWVQ5NJTZvlKX_gdU4cRz7z5NxpnFuAxhBTEO_PvWkfSCJ3zVIn001D8daLC-ehEuo0BJqRTvDujqhThn4ReFxikqJ5YW6zFQ";
    request.uboInfo.uboIdCardNational = "jTpGmxUX3FBWVQ5NJTZvlKX_gdU4cRz7z5NxpnFuAxhBTEO_PvWkfSCJ3zVIn001D8daLC-ehEuo0BJqRTvDujqhThn4ReFxikqJ5YW6zFQ";
    request.uboInfo.uboIdDocCopy = "jTpGmxUX3FBWVQ5NJTZvlKX_gdU4cRz7z5NxpnFuAxhBTEO_PvWkfSCJ3zVIn001D8daLC-ehEuo0BJqRTvDujqhThn4ReFxikqJ5YW6zFQ";
    request.uboInfo.uboName = client.encrypt("ubo_name");
    request.uboInfo.uboIdNumber = client.encrypt("ubo_id_number");
    request.uboInfo.uboIdCardValidDate = "[\\\"2017-10-28\\\",\\\"2037-10-28\\\"]";
    request.additionInfo = new AdditionInfo();
    request.additionInfo.confirmMchidList = new ArrayList<>();
    {
      request.additionInfo.confirmMchidList.add("example_confirmMchidList");
    };
    request.uboInfoList = new ArrayList<>();
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
      request.uboInfoList.add(uboInfoListItem);
    };
    try {
      SubmitApplymentResponse response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public SubmitApplymentResponse run(SubmitApplymentRequest request) {
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

    // 发送HTTP请求
    OkHttpClient client = new OkHttpClient.Builder().build();
    try (Response httpResponse = client.newCall(httpRequest).execute()) {
      String respBody = WXPayUtility.extractBody(httpResponse);
      if (httpResponse.code() >= 200 && httpResponse.code() < 300) {
        // 2XX 成功，验证应答签名
        WXPayUtility.validateResponse(this.wechatPayPublicKeyId, this.wechatPayPublicKey,
            httpResponse.headers(), respBody);

        // 从HTTP应答报文构建返回数据
        return WXPayUtility.fromJson(respBody, SubmitApplymentResponse.class);
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

  public SubmitApplyment(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public String encrypt(String plainText) {
    return WXPayUtility.encrypt(this.wechatPayPublicKey, plainText);
  }

  public static class SubmitApplymentRequest {
    @SerializedName("channel_id")
    public String channelId;
  
    @SerializedName("business_code")
    public String businessCode;
  
    @SerializedName("contact_info")
    public ContactInfo contactInfo;
  
    @SerializedName("subject_info")
    public SubjectInfo subjectInfo;
  
    @SerializedName("identification_info")
    public IdentificationInfo identificationInfo;
  
    @SerializedName("ubo_info")
    public UBOInfo uboInfo;
  
    @SerializedName("addition_info")
    public AdditionInfo additionInfo;
  
    @SerializedName("ubo_info_list")
    public List<UBOInfoList> uboInfoList;
  }
  
  public static class SubmitApplymentResponse {
    @SerializedName("applyment_id")
    public Long applymentId;
  }
  
  public static class ContactInfo {
    @SerializedName("name")
    public String name;
  
    @SerializedName("mobile")
    public String mobile;
  
    @SerializedName("id_card_number")
    public String idCardNumber;
  
    @SerializedName("contact_type")
    public IdHolderType contactType;
  
    @SerializedName("contact_id_doc_type")
    public IdentificationType contactIdDocType;
  
    @SerializedName("contact_id_doc_copy")
    public String contactIdDocCopy;
  
    @SerializedName("contact_id_doc_copy_back")
    public String contactIdDocCopyBack;
  
    @SerializedName("contact_period_begin")
    public String contactPeriodBegin;
  
    @SerializedName("contact_period_end")
    public String contactPeriodEnd;
  }
  
  public static class SubjectInfo {
    @SerializedName("subject_type")
    public SubjectType subjectType;
  
    @SerializedName("is_finance_institution")
    public Boolean isFinanceInstitution;
  
    @SerializedName("business_licence_info")
    public BusinessLicenceInfo businessLicenceInfo;
  
    @SerializedName("certificate_info")
    public CertificateInfo certificateInfo;
  
    @SerializedName("company_prove_copy")
    public String companyProveCopy;
  
    @SerializedName("assist_prove_info")
    public AssitProveInfo assistProveInfo;
  
    @SerializedName("special_operation_list")
    public List<SpecialOperation> specialOperationList;
  
    @SerializedName("finance_institution_info")
    public FinanceInstitutionInfo financeInstitutionInfo;
  }
  
  public static class IdentificationInfo {
    @SerializedName("id_holder_type")
    public IdHolderType idHolderType;
  
    @SerializedName("identification_type")
    public IdentificationType identificationType;
  
    @SerializedName("identification_name")
    public String identificationName;
  
    @SerializedName("identification_number")
    public String identificationNumber;
  
    @SerializedName("identification_valid_date")
    public String identificationValidDate;
  
    @SerializedName("identification_front_copy")
    public String identificationFrontCopy;
  
    @SerializedName("identification_back_copy")
    public String identificationBackCopy;
  
    @SerializedName("authorize_letter_copy")
    public String authorizeLetterCopy;
  
    @SerializedName("owner")
    public Boolean owner;
  
    @SerializedName("identification_address")
    public String identificationAddress;
  }
  
  public static class UBOInfo {
    @SerializedName("ubo_id_type")
    public IdentificationType uboIdType;
  
    @SerializedName("ubo_id_card_copy")
    public String uboIdCardCopy;
  
    @SerializedName("ubo_id_card_national")
    public String uboIdCardNational;
  
    @SerializedName("ubo_id_doc_copy")
    public String uboIdDocCopy;
  
    @SerializedName("ubo_name")
    public String uboName;
  
    @SerializedName("ubo_id_number")
    public String uboIdNumber;
  
    @SerializedName("ubo_id_card_valid_date")
    public String uboIdCardValidDate;
  }
  
  public static class AdditionInfo {
    @SerializedName("confirm_mchid_list")
    public List<String> confirmMchidList;
  }
  
  public static class UBOInfoList {
    @SerializedName("ubo_id_doc_type")
    public IdentificationType uboIdDocType;
  
    @SerializedName("ubo_id_doc_copy")
    public String uboIdDocCopy;
  
    @SerializedName("ubo_id_doc_copy_back")
    public String uboIdDocCopyBack;
  
    @SerializedName("ubo_id_doc_name")
    public String uboIdDocName;
  
    @SerializedName("ubo_id_doc_number")
    public String uboIdDocNumber;
  
    @SerializedName("ubo_id_doc_address")
    public String uboIdDocAddress;
  
    @SerializedName("ubo_period_begin")
    public String uboPeriodBegin;
  
    @SerializedName("ubo_period_end")
    public String uboPeriodEnd;
  }
  
  public enum IdHolderType {
    @SerializedName("LEGAL")
    LEGAL,
    @SerializedName("SUPER")
    SUPER
  }
  
  public enum IdentificationType {
    @SerializedName("IDENTIFICATION_TYPE_IDCARD")
    IDENTIFICATION_TYPE_IDCARD,
    @SerializedName("IDENTIFICATION_TYPE_OVERSEA_PASSPORT")
    IDENTIFICATION_TYPE_OVERSEA_PASSPORT,
    @SerializedName("IDENTIFICATION_TYPE_HONGKONG_PASSPORT")
    IDENTIFICATION_TYPE_HONGKONG_PASSPORT,
    @SerializedName("IDENTIFICATION_TYPE_MACAO_PASSPORT")
    IDENTIFICATION_TYPE_MACAO_PASSPORT,
    @SerializedName("IDENTIFICATION_TYPE_TAIWAN_PASSPORT")
    IDENTIFICATION_TYPE_TAIWAN_PASSPORT,
    @SerializedName("IDENTIFICATION_TYPE_FOREIGN_RESIDENT")
    IDENTIFICATION_TYPE_FOREIGN_RESIDENT,
    @SerializedName("IDENTIFICATION_TYPE_HONGKONG_MACAO_RESIDENT")
    IDENTIFICATION_TYPE_HONGKONG_MACAO_RESIDENT,
    @SerializedName("IDENTIFICATION_TYPE_TAIWAN_RESIDENT")
    IDENTIFICATION_TYPE_TAIWAN_RESIDENT
  }
  
  public enum SubjectType {
    @SerializedName("SUBJECT_TYPE_ENTERPRISE")
    SUBJECT_TYPE_ENTERPRISE,
    @SerializedName("SUBJECT_TYPE_INSTITUTIONS_CLONED")
    SUBJECT_TYPE_INSTITUTIONS_CLONED,
    @SerializedName("SUBJECT_TYPE_INDIVIDUAL")
    SUBJECT_TYPE_INDIVIDUAL,
    @SerializedName("SUBJECT_TYPE_OTHERS")
    SUBJECT_TYPE_OTHERS,
    @SerializedName("SUBJECT_TYPE_MICRO")
    SUBJECT_TYPE_MICRO,
    @SerializedName("SUBJECT_TYPE_GOVERNMENT")
    SUBJECT_TYPE_GOVERNMENT
  }
  
  public static class BusinessLicenceInfo {
    @SerializedName("licence_number")
    public String licenceNumber;
  
    @SerializedName("licence_copy")
    public String licenceCopy;
  
    @SerializedName("merchant_name")
    public String merchantName;
  
    @SerializedName("legal_person")
    public String legalPerson;
  
    @SerializedName("company_address")
    public String companyAddress;
  
    @SerializedName("licence_valid_date")
    public String licenceValidDate;
  }
  
  public static class CertificateInfo {
    @SerializedName("cert_type")
    public CertificateType certType;
  
    @SerializedName("cert_number")
    public String certNumber;
  
    @SerializedName("cert_copy")
    public String certCopy;
  
    @SerializedName("merchant_name")
    public String merchantName;
  
    @SerializedName("legal_person")
    public String legalPerson;
  
    @SerializedName("company_address")
    public String companyAddress;
  
    @SerializedName("cert_valid_date")
    public String certValidDate;
  }
  
  public static class AssitProveInfo {
    @SerializedName("micro_biz_type")
    public MicroBizType microBizType;
  
    @SerializedName("store_name")
    public String storeName;
  
    @SerializedName("store_address_code")
    public String storeAddressCode;
  
    @SerializedName("store_address")
    public String storeAddress;
  
    @SerializedName("store_header_copy")
    public String storeHeaderCopy;
  
    @SerializedName("store_indoor_copy")
    public String storeIndoorCopy;
  }
  
  public static class SpecialOperation {
    @SerializedName("category_id")
    public Long categoryId;
  
    @SerializedName("operation_copy_list")
    public List<String> operationCopyList;
  }
  
  public static class FinanceInstitutionInfo {
    @SerializedName("finance_type")
    public FinanceType financeType;
  
    @SerializedName("finance_license_pics")
    public List<String> financeLicensePics = new ArrayList<String>();
  }
  
  public enum CertificateType {
    @SerializedName("CERTIFICATE_TYPE_2388")
    CERTIFICATE_TYPE_2388,
    @SerializedName("CERTIFICATE_TYPE_2389")
    CERTIFICATE_TYPE_2389,
    @SerializedName("CERTIFICATE_TYPE_2394")
    CERTIFICATE_TYPE_2394,
    @SerializedName("CERTIFICATE_TYPE_2395")
    CERTIFICATE_TYPE_2395,
    @SerializedName("CERTIFICATE_TYPE_2396")
    CERTIFICATE_TYPE_2396,
    @SerializedName("CERTIFICATE_TYPE_2397")
    CERTIFICATE_TYPE_2397,
    @SerializedName("CERTIFICATE_TYPE_2398")
    CERTIFICATE_TYPE_2398,
    @SerializedName("CERTIFICATE_TYPE_2399")
    CERTIFICATE_TYPE_2399,
    @SerializedName("CERTIFICATE_TYPE_2400")
    CERTIFICATE_TYPE_2400,
    @SerializedName("CERTIFICATE_TYPE_2390")
    CERTIFICATE_TYPE_2390,
    @SerializedName("CERTIFICATE_TYPE_2391")
    CERTIFICATE_TYPE_2391,
    @SerializedName("CERTIFICATE_TYPE_2392")
    CERTIFICATE_TYPE_2392,
    @SerializedName("CERTIFICATE_TYPE_2393")
    CERTIFICATE_TYPE_2393,
    @SerializedName("CERTIFICATE_TYPE_2520")
    CERTIFICATE_TYPE_2520,
    @SerializedName("CERTIFICATE_TYPE_2521")
    CERTIFICATE_TYPE_2521,
    @SerializedName("CERTIFICATE_TYPE_2522")
    CERTIFICATE_TYPE_2522
  }
  
  public enum MicroBizType {
    @SerializedName("MICRO_TYPE_STORE")
    MICRO_TYPE_STORE,
    @SerializedName("MICRO_TYPE_MOBILE")
    MICRO_TYPE_MOBILE,
    @SerializedName("MICRO_TYPE_ONLINE")
    MICRO_TYPE_ONLINE
  }
  
  public enum FinanceType {
    @SerializedName("BANK_AGENT")
    BANK_AGENT,
    @SerializedName("PAYMENT_AGENT")
    PAYMENT_AGENT,
    @SerializedName("INSURANCE")
    INSURANCE,
    @SerializedName("TRADE_AND_SETTLE")
    TRADE_AND_SETTLE,
    @SerializedName("OTHER")
    OTHER
  }
  
}
