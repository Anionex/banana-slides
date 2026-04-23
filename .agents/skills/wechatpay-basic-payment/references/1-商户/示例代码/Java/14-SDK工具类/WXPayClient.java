package com.java.utils;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.security.PrivateKey;
import java.security.PublicKey;

/**
 * 微信支付 HTTP 客户端，封装了请求签名、发送、应答验签的完整流程。
 * 依赖 WXPayUtility 提供的签名、验签、序列化等基础能力。
 */
public class WXPayClient {
    private static final String HOST = "https://api.mch.weixin.qq.com";

    private final String mchid;
    private final String certificateSerialNo;
    private final PrivateKey privateKey;
    private final String wechatPayPublicKeyId;
    private final PublicKey wechatPayPublicKey;

    public WXPayClient(String mchid, String certificateSerialNo, String privateKeyFilePath,
                       String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
        this.mchid = mchid;
        this.certificateSerialNo = certificateSerialNo;
        this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
        this.wechatPayPublicKeyId = wechatPayPublicKeyId;
        this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
    }

    /**
     * 发送 GET 请求，返回已验签的应答 Body
     */
    public String sendGet(String uri) {
        return sendRequest("GET", uri, null);
    }

    /**
     * 发送 POST 请求，返回已验签的应答 Body
     */
    public String sendPost(String uri, String reqBody) {
        return sendRequest("POST", uri, reqBody);
    }

    /**
     * 使用公钥加密敏感信息
     */
    public String encrypt(String plainText) {
        return WXPayUtility.encrypt(this.wechatPayPublicKey, plainText);
    }

    private String sendRequest(String method, String uri, String reqBody) {
        Request.Builder reqBuilder = new Request.Builder().url(HOST + uri);
        reqBuilder.addHeader("Accept", "application/json");
        reqBuilder.addHeader("Wechatpay-Serial", wechatPayPublicKeyId);
        reqBuilder.addHeader("Authorization", WXPayUtility.buildAuthorization(
                mchid, certificateSerialNo, privateKey, method, uri, reqBody));

        if (reqBody != null) {
            reqBuilder.addHeader("Content-Type", "application/json");
            RequestBody body = RequestBody.create(
                    MediaType.parse("application/json; charset=utf-8"), reqBody);
            reqBuilder.method(method, body);
        } else {
            reqBuilder.method(method, null);
        }

        OkHttpClient client = new OkHttpClient.Builder().build();
        try (Response httpResponse = client.newCall(reqBuilder.build()).execute()) {
            String respBody = WXPayUtility.extractBody(httpResponse);
            if (httpResponse.code() >= 200 && httpResponse.code() < 300) {
                WXPayUtility.validateResponse(wechatPayPublicKeyId, wechatPayPublicKey,
                        httpResponse.headers(), respBody);
                return respBody;
            } else {
                throw new WXPayUtility.ApiException(httpResponse.code(), respBody, httpResponse.headers());
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Sending request to " + uri + " failed.", e);
        }
    }
}
