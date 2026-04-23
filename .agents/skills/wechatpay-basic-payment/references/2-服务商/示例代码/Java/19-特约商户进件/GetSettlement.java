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
 * 查询结算账户
 *
 * 调用频率限制：100/秒。
 */
public class GetSettlement {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "GET";
  private static String PATH = "/v3/apply4sub/sub_merchants/{sub_mchid}/settlement";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/partner/4013080340
    GetSettlement client = new GetSettlement(
      "19xxxxxxxx",                    // 商户号
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号
      "/path/to/apiclient_key.pem",     // 商户API证书私钥文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径
    );

    GetSettlementRequest request = new GetSettlementRequest();
    request.subMchid = "1900006491";
    request.accountNumberRule = AccountNumberRule.ACCOUNT_NUMBER_RULE_MASK_V1;
    try {
      Settlement response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public Settlement run(GetSettlementRequest request) {
    String uri = PATH;
    uri = uri.replace("{sub_mchid}", WXPayUtility.urlEncode(request.subMchid));
    Map<String, Object> args = new HashMap<>();
    args.put("account_number_rule", request.accountNumberRule);
    String queryString = WXPayUtility.urlEncode(args);
    if (!queryString.isEmpty()) {
        uri = uri + "?" + queryString;
    }

    Request.Builder reqBuilder = new Request.Builder().url(HOST + uri);
    reqBuilder.addHeader("Accept", "application/json");
    reqBuilder.addHeader("Wechatpay-Serial", wechatPayPublicKeyId);
    reqBuilder.addHeader("Authorization", WXPayUtility.buildAuthorization(mchid, certificateSerialNo, privateKey, METHOD, uri, null));
    reqBuilder.method(METHOD, null);
    Request httpRequest = reqBuilder.build();

    OkHttpClient client = new OkHttpClient.Builder().build();
    try (Response httpResponse = client.newCall(httpRequest).execute()) {
      String respBody = WXPayUtility.extractBody(httpResponse);
      if (httpResponse.code() >= 200 && httpResponse.code() < 300) {
        WXPayUtility.validateResponse(this.wechatPayPublicKeyId, this.wechatPayPublicKey,
            httpResponse.headers(), respBody);
        return WXPayUtility.fromJson(respBody, Settlement.class);
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

  public GetSettlement(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class GetSettlementRequest {
    @SerializedName("sub_mchid") @Expose(serialize = false) public String subMchid;
    @SerializedName("account_number_rule") @Expose(serialize = false) public AccountNumberRule accountNumberRule;
  }

  public static class Settlement {
    @SerializedName("account_type") public BankAccountType accountType;
    @SerializedName("account_bank") public String accountBank;
    @SerializedName("bank_name") public String bankName;
    @SerializedName("bank_branch_id") public String bankBranchId;
    @SerializedName("account_number") public String accountNumber;
    @SerializedName("verify_result") public VerifyResult verifyResult;
    @SerializedName("verify_fail_reason") public String verifyFailReason;
  }

  public enum AccountNumberRule {
    @SerializedName("ACCOUNT_NUMBER_RULE_MASK_V1") ACCOUNT_NUMBER_RULE_MASK_V1,
    @SerializedName("ACCOUNT_NUMBER_RULE_MASK_V2") ACCOUNT_NUMBER_RULE_MASK_V2
  }

  public enum BankAccountType {
    @SerializedName("ACCOUNT_TYPE_BUSINESS") ACCOUNT_TYPE_BUSINESS,
    @SerializedName("ACCOUNT_TYPE_PRIVATE") ACCOUNT_TYPE_PRIVATE
  }

  public enum VerifyResult {
    @SerializedName("VERIFY_SUCCESS") VERIFY_SUCCESS,
    @SerializedName("VERIFY_FAIL") VERIFY_FAIL,
    @SerializedName("VERIFYING") VERIFYING
  }
}
