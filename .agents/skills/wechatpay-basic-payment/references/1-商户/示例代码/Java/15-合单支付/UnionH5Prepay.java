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
 * 合单下单-H5
 */
public class UnionH5Prepay {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "POST";
  private static String PATH = "/v3/combine-transactions/h5";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/merchant/4013070756
    UnionH5Prepay client = new UnionH5Prepay(
      "19xxxxxxxx",                    // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考 https://pay.weixin.qq.com/doc/v3/merchant/4013070756
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/v3/merchant/4013053053
      "/path/to/apiclient_key.pem",     // 商户API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/v3/merchant/4013038816
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    UnionAPIv3H5PrepayRequest request = new UnionAPIv3H5PrepayRequest();
    request.combineAppid = "wxd678efh567hg6787";
    request.combineOutTradeNo = "1217752501201407033233368018";
    request.combineMchid = "1230000109";
    request.sceneInfo = new UnionH5SceneInfo();
    request.sceneInfo.payerClientIp = "14.23.150.211";
    request.sceneInfo.deviceId = "013467007045764";
    request.sceneInfo.h5Info = new UnionH5Info();
    request.sceneInfo.h5Info.type = "iOS";
    request.sceneInfo.h5Info.appName = "王者荣耀";
    request.sceneInfo.h5Info.appUrl = "https://pay.qq.com";
    request.sceneInfo.h5Info.bundleId = "com.tencent.wzryiOS";
    request.sceneInfo.h5Info.packageName = "com.tencent.tmgp.sgame";
    request.subOrders = new ArrayList<>();
    {
      UnionCommonSubOrder subOrdersItem0 = new UnionCommonSubOrder();
      subOrdersItem0.mchid = "1230000109";
      subOrdersItem0.outTradeNo = "20150806125346";
      subOrdersItem0.amount = new UnionAmountInfo();
      subOrdersItem0.amount.totalAmount = 10L;
      subOrdersItem0.amount.currency = "CNY";
      subOrdersItem0.attach = "深圳分店";
      subOrdersItem0.description = "腾讯充值中心-QQ会员充值";
      subOrdersItem0.goodsTag = "WXG";
      subOrdersItem0.settleInfo = new UnionSettleInfo();
      subOrdersItem0.settleInfo.profitSharing = false;
      request.subOrders.add(subOrdersItem0);
      UnionCommonSubOrder subOrdersItem1 = new UnionCommonSubOrder();
      subOrdersItem1.mchid = "1230000119";
      subOrdersItem1.outTradeNo = "20150806125347";
      subOrdersItem1.amount = new UnionAmountInfo();
      subOrdersItem1.amount.totalAmount = 10L;
      subOrdersItem1.amount.currency = "CNY";
      subOrdersItem1.attach = "广州分店";
      subOrdersItem1.description = "腾讯充值中心-微信充值";
      subOrdersItem1.goodsTag = "WXG";
      subOrdersItem1.settleInfo = new UnionSettleInfo();
      subOrdersItem1.settleInfo.profitSharing = false;
      request.subOrders.add(subOrdersItem1);
    };
    request.timeExpire = "2018-06-08T10:34:56+08:00";
    request.notifyUrl = "https://yourapp.com/notify";
    try {
      UnionAPIv3H5PrepayResponse response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public UnionAPIv3H5PrepayResponse run(UnionAPIv3H5PrepayRequest request) {
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
        return WXPayUtility.fromJson(respBody, UnionAPIv3H5PrepayResponse.class);
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

  public UnionH5Prepay(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class UnionAPIv3H5PrepayRequest {
    @SerializedName("combine_appid")
    public String combineAppid;
  
    @SerializedName("combine_out_trade_no")
    public String combineOutTradeNo;
  
    @SerializedName("combine_mchid")
    public String combineMchid;
  
    @SerializedName("scene_info")
    public UnionH5SceneInfo sceneInfo;
  
    @SerializedName("sub_orders")
    public List<UnionCommonSubOrder> subOrders = new ArrayList<UnionCommonSubOrder>();
  
    @SerializedName("time_expire")
    public String timeExpire;
  
    @SerializedName("notify_url")
    public String notifyUrl;
  }
  
  public static class UnionAPIv3H5PrepayResponse {
    @SerializedName("h5_url")
    public String h5Url;
  }
  
  public static class UnionH5SceneInfo {
    @SerializedName("payer_client_ip")
    public String payerClientIp;
  
    @SerializedName("device_id")
    public String deviceId;
  
    @SerializedName("h5_info")
    public UnionH5Info h5Info;
  }
  
  public static class UnionCommonSubOrder {
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
  
    @SerializedName("goods_tag")
    public String goodsTag;
  
    @SerializedName("settle_info")
    public UnionSettleInfo settleInfo;
  }
  
  public static class UnionH5Info {
    @SerializedName("type")
    public String type;
  
    @SerializedName("app_name")
    public String appName;
  
    @SerializedName("app_url")
    public String appUrl;
  
    @SerializedName("bundle_id")
    public String bundleId;
  
    @SerializedName("package_name")
    public String packageName;
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
