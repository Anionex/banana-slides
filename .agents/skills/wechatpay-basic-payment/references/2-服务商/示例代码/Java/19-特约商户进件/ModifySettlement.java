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
 * 修改结算账户
 *
 * 服务商/电商平台（不包括支付机构、银行），可使用本接口，修改其进件且已签约特约商户/二级商户的结算银行账户。
 *
 * 注意：
 * 1、提交结算银行账户修改申请后，应答代码为"200"且系统返回申请单号，需通过"查询结算账户修改申请状态API"查询申请单处理结果。
 *    申请单状态存在如下情况：
 *    ① 审核中：修改的银行结算账户还在审核中、账户尚未生效，需继续等待审核结果，在此期间无法再次提交修改申请；
 *       审核过程中，系统可能会向结算银行账户付款0.01元进行验证。
 *    ② 审核驳回：申请已驳回，请检查驳回原因、并重新发起修改。
 *    ③ 审核成功：银行结算账户更新成功。
 * 2、如需查询当前生效中的银行结算账户，请使用"查询结算账户API"。
 * 3、特约商户/二级商户每天仅能提交5次修改申请，如需继续申请，请等到次日0点后重新发起。
 * 4、修改结算银行卡接口调用频率限制：20/min。
 */
public class ModifySettlement {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "POST";
  private static String PATH = "/v3/apply4sub/sub_merchants/{sub_mchid}/modify-settlement";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/partner/4013080340
    ModifySettlement client = new ModifySettlement(
      "19xxxxxxxx",                    // 商户号
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号
      "/path/to/apiclient_key.pem",     // 商户API证书私钥文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径
    );

    ModifySettlementRequest request = new ModifySettlementRequest();
    request.subMchid = "1900006491";
    request.accountType = BankAccountType.ACCOUNT_TYPE_BUSINESS;
    request.accountBank = "工商银行";
    request.bankName = "中国工商银行股份有限公司北京市分行营业部";
    request.bankBranchId = "402713354941";
    request.accountNumber = client.encrypt("account_number");
    request.accountName = client.encrypt("account_name");
    try {
      ModifySettlementResponse response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public ModifySettlementResponse run(ModifySettlementRequest request) {
    String uri = PATH;
    uri = uri.replace("{sub_mchid}", WXPayUtility.urlEncode(request.subMchid));
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
        return WXPayUtility.fromJson(respBody, ModifySettlementResponse.class);
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

  public ModifySettlement(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public String encrypt(String plainText) {
    return WXPayUtility.encrypt(this.wechatPayPublicKey, plainText);
  }

  public static class ModifySettlementRequest {
    @SerializedName("sub_mchid") @Expose(serialize = false) public String subMchid;
    @SerializedName("account_type") public BankAccountType accountType;
    @SerializedName("account_bank") public String accountBank;
    @SerializedName("bank_name") public String bankName;
    @SerializedName("bank_branch_id") public String bankBranchId;
    @SerializedName("account_number") public String accountNumber;
    @SerializedName("account_name") public String accountName;
  }

  public static class ModifySettlementResponse {
    @SerializedName("application_no") public String applicationNo;
  }

  public enum BankAccountType {
    @SerializedName("ACCOUNT_TYPE_BUSINESS") ACCOUNT_TYPE_BUSINESS,
    @SerializedName("ACCOUNT_TYPE_PRIVATE") ACCOUNT_TYPE_PRIVATE
  }
}
