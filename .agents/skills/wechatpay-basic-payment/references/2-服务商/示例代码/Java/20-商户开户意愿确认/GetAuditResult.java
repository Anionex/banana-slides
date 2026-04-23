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
 * 查询申请单审核结果
 */
public class GetAuditResult {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "GET";
  private static String PATH = "/v3/apply4subject/applyment";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/partner/4013080340
    GetAuditResult client = new GetAuditResult(
      "19xxxxxxxx",                    // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考 https://pay.weixin.qq.com/doc/v3/partner/4013080340
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013058924
      "/path/to/apiclient_key.pem",     // 商户API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013038589
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    GetAuditResultRequest request = new GetAuditResultRequest();
    request.applymentId = 20000011111L;
    request.businessCode = "1900013511_10000";
    try {
      GetAuditResultResponse response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public GetAuditResultResponse run(GetAuditResultRequest request) {
    String uri = PATH;
    Map<String, Object> args = new HashMap<>();
    args.put("applyment_id", request.applymentId);
    args.put("business_code", request.businessCode);
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

    // 发送HTTP请求
    OkHttpClient client = new OkHttpClient.Builder().build();
    try (Response httpResponse = client.newCall(httpRequest).execute()) {
      String respBody = WXPayUtility.extractBody(httpResponse);
      if (httpResponse.code() >= 200 && httpResponse.code() < 300) {
        // 2XX 成功，验证应答签名
        WXPayUtility.validateResponse(this.wechatPayPublicKeyId, this.wechatPayPublicKey,
            httpResponse.headers(), respBody);

        // 从HTTP应答报文构建返回数据
        return WXPayUtility.fromJson(respBody, GetAuditResultResponse.class);
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

  public GetAuditResult(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class GetAuditResultRequest {
    @SerializedName("applyment_id")
    @Expose(serialize = false)
    public Long applymentId;
  
    @SerializedName("business_code")
    @Expose(serialize = false)
    public String businessCode;
  }
  
  public static class GetAuditResultResponse {
    @SerializedName("applyment_state")
    public ApplymentState applymentState;
  
    @SerializedName("qrcode_data")
    public String qrcodeData;
  
    @SerializedName("reject_param")
    public String rejectParam;
  
    @SerializedName("reject_reason")
    public String rejectReason;
  }
  
  public enum ApplymentState {
    @SerializedName("APPLYMENT_STATE_EDITTING")
    APPLYMENT_STATE_EDITTING,
    @SerializedName("APPLYMENT_STATE_WAITTING_FOR_AUDIT")
    APPLYMENT_STATE_WAITTING_FOR_AUDIT,
    @SerializedName("APPLYMENT_STATE_WAITTING_FOR_CONFIRM_CONTACT")
    APPLYMENT_STATE_WAITTING_FOR_CONFIRM_CONTACT,
    @SerializedName("APPLYMENT_STATE_WAITTING_FOR_CONFIRM_LEGALPERSON")
    APPLYMENT_STATE_WAITTING_FOR_CONFIRM_LEGALPERSON,
    @SerializedName("APPLYMENT_STATE_PASSED")
    APPLYMENT_STATE_PASSED,
    @SerializedName("APPLYMENT_STATE_REJECTED")
    APPLYMENT_STATE_REJECTED,
    @SerializedName("APPLYMENT_STATE_FREEZED")
    APPLYMENT_STATE_FREEZED,
    @SerializedName("APPLYMENT_STATE_CANCELED")
    APPLYMENT_STATE_CANCELED
  }
  
}
