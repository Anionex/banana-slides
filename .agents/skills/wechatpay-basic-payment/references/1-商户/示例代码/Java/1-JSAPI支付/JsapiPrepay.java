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
 * JSAPI下单
 */
public class JsapiPrepay {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "POST";
  private static String PATH = "/v3/pay/transactions/jsapi";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/merchant/4013070756
    JsapiPrepay client = new JsapiPrepay(
      "19xxxxxxxx",                    // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考 https://pay.weixin.qq.com/doc/v3/merchant/4013070756
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/v3/merchant/4013053053
      "/path/to/apiclient_key.pem",     // 商户API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/v3/merchant/4013038816
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    DirectAPIv3JsapiPrepayRequest request = new DirectAPIv3JsapiPrepayRequest();
    request.appid = "wxd678efh567hg6787";
    request.mchid = "1230000109";
    request.description = "Image形象店-深圳腾大-QQ公仔";
    request.outTradeNo = "1217752501201407033233368018";
    request.timeExpire = "2018-06-08T10:34:56+08:00";
    request.attach = "自定义数据说明";
    request.notifyUrl = " https://www.weixin.qq.com/wxpay/pay.php";
    request.goodsTag = "WXG";
    request.supportFapiao = false;
    request.amount = new CommonAmountInfo();
    request.amount.total = 100L;
    request.amount.currency = "CNY";
    request.payer = new JsapiReqPayerInfo();
    request.payer.openid = "oUpF8uMuAJO_M2pxb1Q9zNjWeS6o";
    request.detail = new CouponInfo();
    request.detail.costPrice = 608800L;
    request.detail.invoiceId = "微信123";
    request.detail.goodsDetail = new ArrayList<>();
    {
      GoodsDetail goodsDetailItem = new GoodsDetail();
      goodsDetailItem.merchantGoodsId = "1246464644";
      goodsDetailItem.wechatpayGoodsId = "1001";
      goodsDetailItem.goodsName = "iPhoneX 256G";
      goodsDetailItem.quantity = 1L;
      goodsDetailItem.unitPrice = 528800L;
      request.detail.goodsDetail.add(goodsDetailItem);
    };
    request.sceneInfo = new CommonSceneInfo();
    request.sceneInfo.payerClientIp = "14.23.150.211";
    request.sceneInfo.deviceId = "013467007045764";
    request.sceneInfo.storeInfo = new StoreInfo();
    request.sceneInfo.storeInfo.id = "0001";
    request.sceneInfo.storeInfo.name = "腾讯大厦分店";
    request.sceneInfo.storeInfo.areaCode = "440305";
    request.sceneInfo.storeInfo.address = "广东省深圳市南山区科技中一道10000号";
    request.settleInfo = new SettleInfo();
    request.settleInfo.profitSharing = false;
    try {
      DirectAPIv3JsapiPrepayResponse response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public DirectAPIv3JsapiPrepayResponse run(DirectAPIv3JsapiPrepayRequest request) {
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
        return WXPayUtility.fromJson(respBody, DirectAPIv3JsapiPrepayResponse.class);
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

  public JsapiPrepay(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class DirectAPIv3JsapiPrepayRequest {
    @SerializedName("appid")
    public String appid;
  
    @SerializedName("mchid")
    public String mchid;
  
    @SerializedName("description")
    public String description;
  
    @SerializedName("out_trade_no")
    public String outTradeNo;
  
    @SerializedName("time_expire")
    public String timeExpire;
  
    @SerializedName("attach")
    public String attach;
  
    @SerializedName("notify_url")
    public String notifyUrl;
  
    @SerializedName("goods_tag")
    public String goodsTag;
  
    @SerializedName("support_fapiao")
    public Boolean supportFapiao;
  
    @SerializedName("amount")
    public CommonAmountInfo amount;
  
    @SerializedName("payer")
    public JsapiReqPayerInfo payer;
  
    @SerializedName("detail")
    public CouponInfo detail;
  
    @SerializedName("scene_info")
    public CommonSceneInfo sceneInfo;
  
    @SerializedName("settle_info")
    public SettleInfo settleInfo;
  }
  
  public static class DirectAPIv3JsapiPrepayResponse {
    @SerializedName("prepay_id")
    public String prepayId;
  }
  
  public static class CommonAmountInfo {
    @SerializedName("total")
    public Long total;
  
    @SerializedName("currency")
    public String currency;
  }
  
  public static class JsapiReqPayerInfo {
    @SerializedName("openid")
    public String openid;
  }
  
  public static class CouponInfo {
    @SerializedName("cost_price")
    public Long costPrice;
  
    @SerializedName("invoice_id")
    public String invoiceId;
  
    @SerializedName("goods_detail")
    public List<GoodsDetail> goodsDetail;
  }
  
  public static class CommonSceneInfo {
    @SerializedName("payer_client_ip")
    public String payerClientIp;
  
    @SerializedName("device_id")
    public String deviceId;
  
    @SerializedName("store_info")
    public StoreInfo storeInfo;
  }
  
  public static class SettleInfo {
    @SerializedName("profit_sharing")
    public Boolean profitSharing;
  }
  
  public static class GoodsDetail {
    @SerializedName("merchant_goods_id")
    public String merchantGoodsId;
  
    @SerializedName("wechatpay_goods_id")
    public String wechatpayGoodsId;
  
    @SerializedName("goods_name")
    public String goodsName;
  
    @SerializedName("quantity")
    public Long quantity;
  
    @SerializedName("unit_price")
    public Long unitPrice;
  }
  
  public static class StoreInfo {
    @SerializedName("id")
    public String id;
  
    @SerializedName("name")
    public String name;
  
    @SerializedName("area_code")
    public String areaCode;
  
    @SerializedName("address")
    public String address;
  }
  
}
