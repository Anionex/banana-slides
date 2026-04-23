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
 * 商户订单号查询订单
 */
public class UnionQueryByOutTradeNo {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "GET";
  private static String PATH = "/v3/combine-transactions/out-trade-no/{combine_out_trade_no}";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/merchant/4013070756
    UnionQueryByOutTradeNo client = new UnionQueryByOutTradeNo(
      "19xxxxxxxx",                    // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考 https://pay.weixin.qq.com/doc/v3/merchant/4013070756
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/v3/merchant/4013053053
      "/path/to/apiclient_key.pem",     // 商户API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/v3/merchant/4013038816
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    UnionQueryByOutTradeNoRequest request = new UnionQueryByOutTradeNoRequest();
    request.combineOutTradeNo = "P20150806125346";
    try {
      UnionAPIv3UnionQueryResponse response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public UnionAPIv3UnionQueryResponse run(UnionQueryByOutTradeNoRequest request) {
    String uri = PATH;
    uri = uri.replace("{combine_out_trade_no}", WXPayUtility.urlEncode(request.combineOutTradeNo));

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
        return WXPayUtility.fromJson(respBody, UnionAPIv3UnionQueryResponse.class);
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

  public UnionQueryByOutTradeNo(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class UnionQueryByOutTradeNoRequest {
    @SerializedName("combine_out_trade_no")
    @Expose(serialize = false)
    public String combineOutTradeNo;
  }
  
  public static class UnionAPIv3UnionQueryResponse {
    @SerializedName("combine_appid")
    public String combineAppid;
  
    @SerializedName("combine_mchid")
    public String combineMchid;
  
    @SerializedName("combine_out_trade_no")
    public String combineOutTradeNo;
  
    @SerializedName("combine_payer_info")
    public UnionCommRespPayerInfo combinePayerInfo;
  
    @SerializedName("scene_info")
    public UnionCommRespSceneInfo sceneInfo;
  
    @SerializedName("sub_orders")
    public List<UnionSubOrder> subOrders;
  }
  
  public static class UnionCommRespPayerInfo {
    @SerializedName("openid")
    public String openid;
  }
  
  public static class UnionCommRespSceneInfo {
    @SerializedName("device_id")
    public String deviceId;
  }
  
  public static class UnionSubOrder {
    @SerializedName("mchid")
    public String mchid;
  
    @SerializedName("sub_mchid")
    public String subMchid;
  
    @SerializedName("sub_appid")
    public String subAppid;
  
    @SerializedName("sub_openid")
    public String subOpenid;
  
    @SerializedName("out_trade_no")
    public String outTradeNo;
  
    @SerializedName("transaction_id")
    public String transactionId;
  
    @SerializedName("trade_type")
    public String tradeType;
  
    @SerializedName("trade_state")
    public String tradeState;
  
    @SerializedName("bank_type")
    public String bankType;
  
    @SerializedName("attach")
    public String attach;
  
    @SerializedName("success_time")
    public String successTime;
  
    @SerializedName("amount")
    public UnionCommRespAmountInfo amount;
  
    @SerializedName("promotion_detail")
    public List<UnionPromotionDetail> promotionDetail;
  }
  
  public static class UnionCommRespAmountInfo {
    @SerializedName("total_amount")
    public Long totalAmount;
  
    @SerializedName("payer_amount")
    public Long payerAmount;
  
    @SerializedName("currency")
    public String currency;
  
    @SerializedName("payer_currency")
    public String payerCurrency;
  
    @SerializedName("settlement_rate")
    public Long settlementRate;
  }
  
  public static class UnionPromotionDetail {
    @SerializedName("coupon_id")
    public String couponId;
  
    @SerializedName("name")
    public String name;
  
    @SerializedName("scope")
    public String scope;
  
    @SerializedName("type")
    public String type;
  
    @SerializedName("amount")
    public Long amount;
  
    @SerializedName("stock_id")
    public String stockId;
  
    @SerializedName("wechatpay_contribute")
    public Long wechatpayContribute;
  
    @SerializedName("merchant_contribute")
    public Long merchantContribute;
  
    @SerializedName("other_contribute")
    public Long otherContribute;
  
    @SerializedName("currency")
    public String currency;
  
    @SerializedName("goods_detail")
    public List<GoodsDetailInPromotion> goodsDetail;
  }
  
  public static class GoodsDetailInPromotion {
    @SerializedName("goods_id")
    public String goodsId;
  
    @SerializedName("quantity")
    public Long quantity;
  
    @SerializedName("unit_price")
    public Long unitPrice;
  
    @SerializedName("discount_amount")
    public Long discountAmount;
  
    @SerializedName("goods_remark")
    public String goodsRemark;
  }
  
}
