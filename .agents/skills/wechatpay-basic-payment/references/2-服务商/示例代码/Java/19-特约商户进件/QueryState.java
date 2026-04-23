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
 * 查询申请单状态
 */
public class QueryState {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "GET";
  private static String PATH = "/v3/applyment4sub/applyment/business_code/{business_code}";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/partner/4013080340
    QueryState client = new QueryState(
      "19xxxxxxxx",                    // 商户号
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号
      "/path/to/apiclient_key.pem",     // 商户API证书私钥文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径
    );

    QueryStateRequest request = new QueryStateRequest();
    request.businessCode = "1900013511_10000";
    try {
      QueryStateResp response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public QueryStateResp run(QueryStateRequest request) {
    String uri = PATH;
    uri = uri.replace("{business_code}", WXPayUtility.urlEncode(request.businessCode));

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
        return WXPayUtility.fromJson(respBody, QueryStateResp.class);
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

  public QueryState(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class QueryStateRequest {
    @SerializedName("business_code")
    @Expose(serialize = false)
    public String businessCode;
  }

  public static class QueryStateResp {
    @SerializedName("business_code") public String businessCode;
    @SerializedName("applyment_id") public Long applymentId;
    @SerializedName("sub_mchid") public String subMchid;
    @SerializedName("sign_url") public String signUrl;
    @SerializedName("applyment_state") public ApplymentState applymentState;
    @SerializedName("applyment_state_msg") public String applymentStateMsg;
    @SerializedName("audit_detail") public List<AuditDetail> auditDetail;
  }

  public enum ApplymentState {
    @SerializedName("APPLYMENT_STATE_EDITTING") APPLYMENT_STATE_EDITTING,
    @SerializedName("APPLYMENT_STATE_AUDITING") APPLYMENT_STATE_AUDITING,
    @SerializedName("APPLYMENT_STATE_REJECTED") APPLYMENT_STATE_REJECTED,
    @SerializedName("APPLYMENT_STATE_TO_BE_CONFIRMED") APPLYMENT_STATE_TO_BE_CONFIRMED,
    @SerializedName("APPLYMENT_STATE_TO_BE_SIGNED") APPLYMENT_STATE_TO_BE_SIGNED,
    @SerializedName("APPLYMENT_STATE_FINISHED") APPLYMENT_STATE_FINISHED,
    @SerializedName("APPLYMENT_STATE_CANCELED") APPLYMENT_STATE_CANCELED,
    @SerializedName("APPLYMENT_STATE_SIGNING") APPLYMENT_STATE_SIGNING
  }

  public static class AuditDetail {
    @SerializedName("field") public String field;
    @SerializedName("field_name") public String fieldName;
    @SerializedName("reject_reason") public String rejectReason;
  }
}
