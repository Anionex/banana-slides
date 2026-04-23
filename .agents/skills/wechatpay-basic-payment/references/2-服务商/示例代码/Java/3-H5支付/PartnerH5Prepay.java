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
 * H5下单
 */
public class PartnerH5Prepay {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "POST";
  private static String PATH = "/v3/pay/partner/transactions/h5";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/partner/4013080340
    PartnerH5Prepay client = new PartnerH5Prepay(
      "19xxxxxxxx",
      "1DDE55AD98Exxxxxxxxxx",
      "/path/to/apiclient_key.pem",
      "PUB_KEY_ID_xxxxxxxxxxxxx",
      "/path/to/wxp_pub.pem"
    );

    PartnerAPIv3PartnerH5PrepayRequest request = new PartnerAPIv3PartnerH5PrepayRequest();
    request.spAppid = "wx8888888888888888";
    request.spMchid = "1230000109";
    request.subAppid = "wxd678efh567hg6999";
    request.subMchid = "1900000109";
    request.description = "Image形象店-深圳腾大-QQ公仔";
    request.outTradeNo = "1217752501201407033233368018";
    request.timeExpire = "2018-06-08T10:34:56+08:00";
    request.attach = "自定义数据说明";
    request.notifyUrl = " https://www.weixin.qq.com/wxpay/pay.php";
    request.goodsTag = "WXG";
    request.settleInfo = new PartnerSettleInfo();
    request.settleInfo.profitSharing = true;
    request.supportFapiao = false;
    request.amount = new CommonAmountInfo();
    request.amount.total = 100L;
    request.amount.currency = "CNY";
    request.detail = new CouponInfo();
    request.detail.costPrice = 608800L;
    request.detail.invoiceId = "微信123";
    request.detail.goodsDetail = new ArrayList<>();
    {
      GoodsDetail goodsDetailItem0 = new GoodsDetail();
      goodsDetailItem0.merchantGoodsId = "1246464644";
      goodsDetailItem0.wechatpayGoodsId = "1001";
      goodsDetailItem0.goodsName = "iPhoneX 256G";
      goodsDetailItem0.quantity = 1L;
      goodsDetailItem0.unitPrice = 528800L;
      request.detail.goodsDetail.add(goodsDetailItem0);
    };
    request.sceneInfo = new H5ReqSceneInfo();
    request.sceneInfo.payerClientIp = "14.23.150.211";
    request.sceneInfo.deviceId = "013467007045764";
    request.sceneInfo.storeInfo = new StoreInfo();
    request.sceneInfo.storeInfo.id = "0001";
    request.sceneInfo.storeInfo.name = "腾讯大厦分店";
    request.sceneInfo.storeInfo.areaCode = "440305";
    request.sceneInfo.storeInfo.address = "广东省深圳市南山区科技中一道10000号";
    request.sceneInfo.h5Info = new H5Info();
    request.sceneInfo.h5Info.type = "iOS";
    request.sceneInfo.h5Info.appName = "王者荣耀";
    request.sceneInfo.h5Info.appUrl = "https://pay.qq.com";
    request.sceneInfo.h5Info.bundleId = "com.tencent.wzryiOS";
    request.sceneInfo.h5Info.packageName = "com.tencent.tmgp.sgame";
    try {
      PartnerAPIv3PartnerH5PrepayResponse response = client.run(request);
        System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
        e.printStackTrace();
    }
  }

  public PartnerAPIv3PartnerH5PrepayResponse run(PartnerAPIv3PartnerH5PrepayRequest request) {
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

    OkHttpClient client = new OkHttpClient.Builder().build();
    try (Response httpResponse = client.newCall(httpRequest).execute()) {
      String respBody = WXPayUtility.extractBody(httpResponse);
      if (httpResponse.code() >= 200 && httpResponse.code() < 300) {
        WXPayUtility.validateResponse(this.wechatPayPublicKeyId, this.wechatPayPublicKey,
            httpResponse.headers(), respBody);
        return WXPayUtility.fromJson(respBody, PartnerAPIv3PartnerH5PrepayResponse.class);
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

  public PartnerH5Prepay(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class PartnerAPIv3PartnerH5PrepayRequest {
    @SerializedName("sp_appid") public String spAppid;
    @SerializedName("sp_mchid") public String spMchid;
    @SerializedName("sub_appid") public String subAppid;
    @SerializedName("sub_mchid") public String subMchid;
    @SerializedName("description") public String description;
    @SerializedName("out_trade_no") public String outTradeNo;
    @SerializedName("time_expire") public String timeExpire;
    @SerializedName("attach") public String attach;
    @SerializedName("notify_url") public String notifyUrl;
    @SerializedName("goods_tag") public String goodsTag;
    @SerializedName("settle_info") public PartnerSettleInfo settleInfo;
    @SerializedName("support_fapiao") public Boolean supportFapiao;
    @SerializedName("amount") public CommonAmountInfo amount;
    @SerializedName("detail") public CouponInfo detail;
    @SerializedName("scene_info") public H5ReqSceneInfo sceneInfo;
  }

  public static class PartnerAPIv3PartnerH5PrepayResponse {
    @SerializedName("h5_url") public String h5Url;
  }

  public static class PartnerSettleInfo {
    @SerializedName("profit_sharing") public Boolean profitSharing;
  }

  public static class CommonAmountInfo {
    @SerializedName("total") public Long total;
    @SerializedName("currency") public String currency;
  }

  public static class CouponInfo {
    @SerializedName("cost_price") public Long costPrice;
    @SerializedName("invoice_id") public String invoiceId;
    @SerializedName("goods_detail") public List<GoodsDetail> goodsDetail;
  }

  public static class H5ReqSceneInfo {
    @SerializedName("payer_client_ip") public String payerClientIp;
    @SerializedName("device_id") public String deviceId;
    @SerializedName("store_info") public StoreInfo storeInfo;
    @SerializedName("h5_info") public H5Info h5Info;
  }

  public static class GoodsDetail {
    @SerializedName("merchant_goods_id") public String merchantGoodsId;
    @SerializedName("wechatpay_goods_id") public String wechatpayGoodsId;
    @SerializedName("goods_name") public String goodsName;
    @SerializedName("quantity") public Long quantity;
    @SerializedName("unit_price") public Long unitPrice;
  }

  public static class StoreInfo {
    @SerializedName("id") public String id;
    @SerializedName("name") public String name;
    @SerializedName("area_code") public String areaCode;
    @SerializedName("address") public String address;
  }

  public static class H5Info {
    @SerializedName("type") public String type;
    @SerializedName("app_name") public String appName;
    @SerializedName("app_url") public String appUrl;
    @SerializedName("bundle_id") public String bundleId;
    @SerializedName("package_name") public String packageName;
  }

}
