package com.java.demo;

import com.java.utils.WXPayUtility; // 引用微信支付工具库，参考：https://pay.weixin.qq.com/doc/v3/merchant/4014931831

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
 * 请求分账回退
 */
public class CreateReturnOrder {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "POST";
  private static String PATH = "/v3/profitsharing/return-orders";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/merchant/4013070756
    CreateReturnOrder client = new CreateReturnOrder(
      "19xxxxxxxx",                    // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考 https://pay.weixin.qq.com/doc/v3/merchant/4013070756
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/v3/merchant/4013053053
      "/path/to/apiclient_key.pem",     // 商户API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/v3/merchant/4013038816
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    CreateReturnOrderRequest request = new CreateReturnOrderRequest();
    request.orderId = "3008450740201411110007820472";
    request.outOrderNo = "P20150806125346";
    request.outReturnNo = "R20190516001";
    request.returnMchid = "86693852";
    request.amount = 10L;
    request.description = "用户退款";
    try {
      ReturnOrdersEntity response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public ReturnOrdersEntity run(CreateReturnOrderRequest request) {
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
        return WXPayUtility.fromJson(respBody, ReturnOrdersEntity.class);
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

  public CreateReturnOrder(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class CreateReturnOrderRequest {
    @SerializedName("order_id")
    public String orderId;
  
    @SerializedName("out_order_no")
    public String outOrderNo;
  
    @SerializedName("out_return_no")
    public String outReturnNo;
  
    @SerializedName("return_mchid")
    public String returnMchid;
  
    @SerializedName("amount")
    public Long amount;
  
    @SerializedName("description")
    public String description;
  }
  
  public static class ReturnOrdersEntity {
    @SerializedName("order_id")
    public String orderId;
  
    @SerializedName("out_order_no")
    public String outOrderNo;
  
    @SerializedName("out_return_no")
    public String outReturnNo;
  
    @SerializedName("return_id")
    public String returnId;
  
    @SerializedName("return_mchid")
    public String returnMchid;
  
    @SerializedName("amount")
    public Long amount;
  
    @SerializedName("description")
    public String description;
  
    @SerializedName("result")
    public ReturnOrderStatus result;
  
    @SerializedName("fail_reason")
    public ReturnOrderFailReason failReason;
  
    @SerializedName("create_time")
    public String createTime;
  
    @SerializedName("finish_time")
    public String finishTime;
  }
  
  public enum ReturnOrderStatus {
    @SerializedName("PROCESSING")
    PROCESSING,
    @SerializedName("SUCCESS")
    SUCCESS,
    @SerializedName("FAILED")
    FAILED
  }
  
  public enum ReturnOrderFailReason {
    @SerializedName("ACCOUNT_ABNORMAL")
    ACCOUNT_ABNORMAL,
    @SerializedName("BALANCE_NOT_ENOUGH")
    BALANCE_NOT_ENOUGH,
    @SerializedName("TIME_OUT_CLOSED")
    TIME_OUT_CLOSED,
    @SerializedName("PAYER_ACCOUNT_ABNORMAL")
    PAYER_ACCOUNT_ABNORMAL,
    @SerializedName("INVALID_REQUEST")
    INVALID_REQUEST
  }
  
}
