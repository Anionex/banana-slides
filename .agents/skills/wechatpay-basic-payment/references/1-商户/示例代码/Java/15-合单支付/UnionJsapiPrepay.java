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
 * 合单下单-JSAPI
 */
public class UnionJsapiPrepay {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "POST";
  private static String PATH = "/v3/combine-transactions/jsapi";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/merchant/4013070756
    UnionJsapiPrepay client = new UnionJsapiPrepay(
      "19xxxxxxxx",                    // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考 https://pay.weixin.qq.com/doc/v3/merchant/4013070756
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/v3/merchant/4013053053
      "/path/to/apiclient_key.pem",     // 商户API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/v3/merchant/4013038816
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    UnionAPIv3JsapiPrepayRequest request = new UnionAPIv3JsapiPrepayRequest();
    request.combineAppid = "wxd678efh567hg6787";
    request.combineMchid = "1230000109";
    request.combineOutTradeNo = "1217752501201407033233368018";
    request.combinePayerInfo = new UnionPayerInfo();
    request.combinePayerInfo.openid = "oUpF8uMuAJO_M2pxb1Q9zNjWeS6o";
    request.sceneInfo = new UnionSceneInfo();
    request.sceneInfo.deviceId = "POS1:1";
    request.sceneInfo.payerClientIp = "14.17.22.32";
    request.subOrders = new ArrayList<>();
    {
      UnionSubOrder subOrdersItem0 = new UnionSubOrder();
      subOrdersItem0.mchid = "1230000109";
      subOrdersItem0.outTradeNo = "20150806125346";
      subOrdersItem0.amount = new UnionAmountInfo();
      subOrdersItem0.amount.totalAmount = 10L;
      subOrdersItem0.amount.currency = "CNY";
      subOrdersItem0.attach = "深圳分店";
      subOrdersItem0.description = "腾讯充值中心-QQ会员充值";
      subOrdersItem0.detail = "买单费用";
      subOrdersItem0.goodsTag = "WXG";
      subOrdersItem0.settleInfo = new UnionSettleInfo();
      subOrdersItem0.settleInfo.profitSharing = false;
      request.subOrders.add(subOrdersItem0);
      UnionSubOrder subOrdersItem1 = new UnionSubOrder();
      subOrdersItem1.mchid = "1230000119";
      subOrdersItem1.outTradeNo = "20150806125347";
      subOrdersItem1.amount = new UnionAmountInfo();
      subOrdersItem1.amount.totalAmount = 10L;
      subOrdersItem1.amount.currency = "CNY";
      subOrdersItem1.attach = "广州分店";
      subOrdersItem1.description = "腾讯充值中心-微信充值";
      subOrdersItem1.detail = "买单费用";
      subOrdersItem1.goodsTag = "WXG";
      subOrdersItem1.settleInfo = new UnionSettleInfo();
      subOrdersItem1.settleInfo.profitSharing = false;
      request.subOrders.add(subOrdersItem1);
    };
    request.timeExpire = "2018-06-08T10:34:56+08:00";
    request.notifyUrl = "https://yourapp.com/notify";
    try {
      UnionAPIv3JsapiPrepayResponse response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public UnionAPIv3JsapiPrepayResponse run(UnionAPIv3JsapiPrepayRequest request) {
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
        return WXPayUtility.fromJson(respBody, UnionAPIv3JsapiPrepayResponse.class);
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

  public UnionJsapiPrepay(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class UnionAPIv3JsapiPrepayRequest {
    @SerializedName("combine_appid")
    public String combineAppid;
  
    @SerializedName("combine_mchid")
    public String combineMchid;
  
    @SerializedName("combine_out_trade_no")
    public String combineOutTradeNo;
  
    @SerializedName("combine_payer_info")
    public UnionPayerInfo combinePayerInfo;
  
    @SerializedName("scene_info")
    public UnionSceneInfo sceneInfo;
  
    @SerializedName("sub_orders")
    public List<UnionSubOrder> subOrders = new ArrayList<UnionSubOrder>();
  
    @SerializedName("time_expire")
    public String timeExpire;
  
    @SerializedName("notify_url")
    public String notifyUrl;
  }
  
  public static class UnionAPIv3JsapiPrepayResponse {
    @SerializedName("prepay_id")
    public String prepayId;
  }
  
  public static class UnionPayerInfo {
    @SerializedName("openid")
    public String openid;
  
    @SerializedName("sub_openid")
    public String subOpenid;
  }
  
  public static class UnionSceneInfo {
    @SerializedName("device_id")
    public String deviceId;
  
    @SerializedName("payer_client_ip")
    public String payerClientIp;
  }
  
  public static class UnionSubOrder {
    @SerializedName("mchid")
    public String mchid;
  
    @SerializedName("out_trade_no")
    public String outTradeNo;
  
    @SerializedName("amount")
    public UnionAmountInfo amount;
  
    @SerializedName("attach")
    public String attach;
  
    @SerializedName("description")
    public String description;
  
    @SerializedName("detail")
    public String detail;
  
    @SerializedName("goods_tag")
    public String goodsTag;
  
    @SerializedName("settle_info")
    public UnionSettleInfo settleInfo;
  }
  
  public static class UnionAmountInfo {
    @SerializedName("total_amount")
    public Long totalAmount;
  
    @SerializedName("currency")
    public String currency;
  }
  
  public static class UnionSettleInfo {
    @SerializedName("profit_sharing")
    public Boolean profitSharing;
  }
  
}
