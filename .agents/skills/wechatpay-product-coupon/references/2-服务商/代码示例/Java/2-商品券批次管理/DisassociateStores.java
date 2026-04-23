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
 * 批次取消关联门店
 */
public class DisassociateStores {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "POST";
  private static String PATH = "/v3/marketing/partner/product-coupon/product-coupons/{product_coupon_id}/stocks/{stock_id}/disassociate-stores";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/partner/4013080340
    DisassociateStores client = new DisassociateStores(
      "19xxxxxxxx",                    // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考 https://pay.weixin.qq.com/doc/v3/partner/4013080340
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013058924
      "/path/to/apiclient_key.pem",     // 商户API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013038589
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    DisassociateStoresRequest request = new DisassociateStoresRequest();
    request.productCouponId = "1000000013";
    request.stockId = "1000000013001";
    request.storeList = new ArrayList<>();
    {
      StoreInfo storeListItem0 = new StoreInfo();
      storeListItem0.storeId = "100000001";
      request.storeList.add(storeListItem0);
      StoreInfo storeListItem1 = new StoreInfo();
      storeListItem1.storeId = "100000002";
      request.storeList.add(storeListItem1);
      StoreInfo storeListItem2 = new StoreInfo();
      storeListItem2.storeId = "100000003";
      request.storeList.add(storeListItem2);
      StoreInfo storeListItem3 = new StoreInfo();
      storeListItem3.storeId = "12";
      request.storeList.add(storeListItem3);
    };
    request.brandId = "120344";
    try {
      DisassociateStoresResponse response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public DisassociateStoresResponse run(DisassociateStoresRequest request) {
    String uri = PATH;
    uri = uri.replace("{product_coupon_id}", WXPayUtility.urlEncode(request.productCouponId));
    uri = uri.replace("{stock_id}", WXPayUtility.urlEncode(request.stockId));
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
        return WXPayUtility.fromJson(respBody, DisassociateStoresResponse.class);
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

  public DisassociateStores(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class DisassociateStoresRequest {
    @SerializedName("product_coupon_id")
    @Expose(serialize = false)
    public String productCouponId;
  
    @SerializedName("stock_id")
    @Expose(serialize = false)
    public String stockId;
  
    @SerializedName("store_list")
    public List<StoreInfo> storeList = new ArrayList<StoreInfo>();
  
    @SerializedName("brand_id")
    public String brandId;
  }
  
  public static class DisassociateStoresResponse {
    @SerializedName("total_count")
    public Long totalCount;
  
    @SerializedName("success_store_list")
    public List<StoreInfo> successStoreList;
  
    @SerializedName("failed_store_list")
    public List<FailedStoreInfo> failedStoreList;
  }
  
  public static class StoreInfo {
    @SerializedName("store_id")
    public String storeId;
  }
  
  public static class FailedStoreInfo {
    @SerializedName("store_id")
    public String storeId;
  
    @SerializedName("code")
    public String code;
  
    @SerializedName("message")
    public String message;
  }
  
}
