package main

import (
	"bytes"
	"demo/wxpay_utility"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

func main() {
	config, err := wxpay_utility.CreateMchConfig(
		"19xxxxxxxx", "1DDE55AD98Exxxxxxxxxx",
		"/path/to/apiclient_key.pem", "PUB_KEY_ID_xxxxxxxxxxxxx", "/path/to/wxp_pub.pem",
	)
	if err != nil { fmt.Println(err); return }

	request := &UpdateStockBundleRequest{
		ProductCouponId: wxpay_utility.String("200000001"),
		StockBundleId:   wxpay_utility.String("123456789"),
		OutRequestNo:    wxpay_utility.String("34657_20250101_123456"),
		Remark:          wxpay_utility.String("疯狂星期四项目专用"),
		UsageRuleDisplayInfo: &UsageRuleDisplayInfo{
			CouponUsageMethodList: []CouponUsageMethod{COUPONUSAGEMETHOD_OFFLINE},
			MiniProgramAppid: wxpay_utility.String("wx1234567890"),
			MiniProgramPath:  wxpay_utility.String("/pages/index/product"),
			AppPath:          wxpay_utility.String("https://www.example.com/jump-to-app"),
			UsageDescription: wxpay_utility.String("全场可用"),
			CouponAvailableStoreInfo: &CouponAvailableStoreInfo{
				Description: wxpay_utility.String("可在上海市区的所有门店使用，详细列表参考小程序内信息为准"),
				MiniProgramAppid: wxpay_utility.String("wx1234567890"),
				MiniProgramPath:  wxpay_utility.String("/pages/index/store-list"),
			},
		},
		CouponDisplayInfo: &CouponDisplayInfo{
			CodeDisplayMode: COUPONCODEDISPLAYMODE_QRCODE.Ptr(),
			BackgroundColor: wxpay_utility.String("Color010"),
			EntranceMiniProgram: &EntranceMiniProgram{
				Appid: wxpay_utility.String("wx1234567890"), Path: wxpay_utility.String("/pages/index/product"),
				EntranceWording: wxpay_utility.String("欢迎选购"), GuidanceWording: wxpay_utility.String("获取更多优惠"),
			},
			EntranceOfficialAccount: &EntranceOfficialAccount{Appid: wxpay_utility.String("wx1234567890")},
			EntranceFinder: &EntranceFinder{
				FinderId: wxpay_utility.String("gh_12345678"), FinderVideoId: wxpay_utility.String("UDFsdf24df34dD456Hdf34"),
				FinderVideoCoverImageUrl: wxpay_utility.String("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"),
			},
		},
		NotifyConfig: &NotifyConfig{NotifyAppid: wxpay_utility.String("wx4fd12345678")},
		StoreScope:   STOCKSTORESCOPE_SPECIFIC.Ptr(),
		BrandId:      wxpay_utility.String("120344"),
	}

	response, err := UpdateStockBundle(config, request)
	if err != nil { fmt.Printf("请求失败: %+v\n", err); return }
	fmt.Printf("请求成功: %+v\n", response)
}

func UpdateStockBundle(config *wxpay_utility.MchConfig, request *UpdateStockBundleRequest) (*StockBundleEntity, error) {
	const (host = "https://api.mch.weixin.qq.com"; method = "PATCH"
		path = "/v3/marketing/partner/product-coupon/product-coupons/{product_coupon_id}/stock-bundles/{stock_bundle_id}")
	reqUrl, err := url.Parse(fmt.Sprintf("%s%s", host, path))
	if err != nil { return nil, err }
	reqUrl.Path = strings.Replace(reqUrl.Path, "{product_coupon_id}", url.PathEscape(*request.ProductCouponId), -1)
	reqUrl.Path = strings.Replace(reqUrl.Path, "{stock_bundle_id}", url.PathEscape(*request.StockBundleId), -1)
	reqBody, err := json.Marshal(request)
	if err != nil { return nil, err }
	httpRequest, err := http.NewRequest(method, reqUrl.String(), bytes.NewReader(reqBody))
	if err != nil { return nil, err }
	httpRequest.Header.Set("Accept", "application/json")
	httpRequest.Header.Set("Wechatpay-Serial", config.WechatPayPublicKeyId())
	httpRequest.Header.Set("Content-Type", "application/json")
	auth, err := wxpay_utility.BuildAuthorization(config.MchId(), config.CertificateSerialNo(), config.PrivateKey(), method, reqUrl.RequestURI(), reqBody)
	if err != nil { return nil, err }
	httpRequest.Header.Set("Authorization", auth)
	client := &http.Client{}
	httpResponse, err := client.Do(httpRequest)
	if err != nil { return nil, err }
	respBody, err := wxpay_utility.ExtractResponseBody(httpResponse)
	if err != nil { return nil, err }
	if httpResponse.StatusCode >= 200 && httpResponse.StatusCode < 300 {
		err = wxpay_utility.ValidateResponse(config.WechatPayPublicKeyId(), config.WechatPayPublicKey(), &httpResponse.Header, respBody)
		if err != nil { return nil, err }
		resp := &StockBundleEntity{}
		if err := json.Unmarshal(respBody, resp); err != nil { return nil, err }
		return resp, nil
	}
	return nil, wxpay_utility.NewApiException(httpResponse.StatusCode, httpResponse.Header, respBody)
}

type UpdateStockBundleRequest struct {
	OutRequestNo *string `json:"out_request_no,omitempty"`; ProductCouponId *string `json:"product_coupon_id,omitempty"`
	StockBundleId *string `json:"stock_bundle_id,omitempty"`; Remark *string `json:"remark,omitempty"`
	UsageRuleDisplayInfo *UsageRuleDisplayInfo `json:"usage_rule_display_info,omitempty"`
	CouponDisplayInfo *CouponDisplayInfo `json:"coupon_display_info,omitempty"`
	NotifyConfig *NotifyConfig `json:"notify_config,omitempty"`; StoreScope *StockStoreScope `json:"store_scope,omitempty"`
	BrandId *string `json:"brand_id,omitempty"`
}
func (o *UpdateStockBundleRequest) MarshalJSON() ([]byte, error) {
	type Alias UpdateStockBundleRequest
	return json.Marshal(&struct{ProductCouponId *string `json:"product_coupon_id,omitempty"`; StockBundleId *string `json:"stock_bundle_id,omitempty"`; *Alias}{nil, nil, (*Alias)(o)})
}
type StockBundleEntity struct { StockBundleId *string `json:"stock_bundle_id,omitempty"`; StockList []StockEntityInBundle `json:"stock_list,omitempty"` }
type UsageRuleDisplayInfo struct {
	CouponUsageMethodList []CouponUsageMethod `json:"coupon_usage_method_list,omitempty"`; MiniProgramAppid *string `json:"mini_program_appid,omitempty"`
	MiniProgramPath *string `json:"mini_program_path,omitempty"`; AppPath *string `json:"app_path,omitempty"`; UsageDescription *string `json:"usage_description,omitempty"`
	CouponAvailableStoreInfo *CouponAvailableStoreInfo `json:"coupon_available_store_info,omitempty"`
}
type CouponDisplayInfo struct {
	CodeDisplayMode *CouponCodeDisplayMode `json:"code_display_mode,omitempty"`; BackgroundColor *string `json:"background_color,omitempty"`
	EntranceMiniProgram *EntranceMiniProgram `json:"entrance_mini_program,omitempty"`; EntranceOfficialAccount *EntranceOfficialAccount `json:"entrance_official_account,omitempty"`
	EntranceFinder *EntranceFinder `json:"entrance_finder,omitempty"`
}
type NotifyConfig struct { NotifyAppid *string `json:"notify_appid,omitempty"` }
type StockStoreScope string; func (e StockStoreScope) Ptr() *StockStoreScope { return &e }
const (STOCKSTORESCOPE_NONE StockStoreScope = "NONE"; STOCKSTORESCOPE_ALL StockStoreScope = "ALL"; STOCKSTORESCOPE_SPECIFIC StockStoreScope = "SPECIFIC")
type StockEntityInBundle struct {
	ProductCouponId *string `json:"product_coupon_id,omitempty"`; StockId *string `json:"stock_id,omitempty"`; Remark *string `json:"remark,omitempty"`
	CouponCodeMode *CouponCodeMode `json:"coupon_code_mode,omitempty"`; CouponCodeCountInfo *CouponCodeCountInfo `json:"coupon_code_count_info,omitempty"`
	StockSendRule *StockSendRule `json:"stock_send_rule,omitempty"`; ProgressiveBundleUsageRule *StockUsageRule `json:"progressive_bundle_usage_rule,omitempty"`
	StockBundleInfo *StockBundleInfo `json:"stock_bundle_info,omitempty"`; UsageRuleDisplayInfo *UsageRuleDisplayInfo `json:"usage_rule_display_info,omitempty"`
	CouponDisplayInfo *CouponDisplayInfo `json:"coupon_display_info,omitempty"`; NotifyConfig *NotifyConfig `json:"notify_config,omitempty"`
	StoreScope *StockStoreScope `json:"store_scope,omitempty"`; SentCountInfo *StockSentCountInfo `json:"sent_count_info,omitempty"`
	State *StockState `json:"state,omitempty"`; DeactivateRequestNo *string `json:"deactivate_request_no,omitempty"`
	DeactivateTime *time.Time `json:"deactivate_time,omitempty"`; DeactivateReason *string `json:"deactivate_reason,omitempty"`; BrandId *string `json:"brand_id,omitempty"`
}
type CouponUsageMethod string; func (e CouponUsageMethod) Ptr() *CouponUsageMethod { return &e }
const (COUPONUSAGEMETHOD_OFFLINE CouponUsageMethod = "OFFLINE"; COUPONUSAGEMETHOD_MINI_PROGRAM CouponUsageMethod = "MINI_PROGRAM"; COUPONUSAGEMETHOD_APP CouponUsageMethod = "APP"; COUPONUSAGEMETHOD_PAYMENT_CODE CouponUsageMethod = "PAYMENT_CODE")
type CouponAvailableStoreInfo struct { Description *string `json:"description,omitempty"`; MiniProgramAppid *string `json:"mini_program_appid,omitempty"`; MiniProgramPath *string `json:"mini_program_path,omitempty"` }
type CouponCodeDisplayMode string; func (e CouponCodeDisplayMode) Ptr() *CouponCodeDisplayMode { return &e }
const (COUPONCODEDISPLAYMODE_INVISIBLE CouponCodeDisplayMode = "INVISIBLE"; COUPONCODEDISPLAYMODE_BARCODE CouponCodeDisplayMode = "BARCODE"; COUPONCODEDISPLAYMODE_QRCODE CouponCodeDisplayMode = "QRCODE")
type EntranceMiniProgram struct { Appid *string `json:"appid,omitempty"`; Path *string `json:"path,omitempty"`; EntranceWording *string `json:"entrance_wording,omitempty"`; GuidanceWording *string `json:"guidance_wording,omitempty"` }
type EntranceOfficialAccount struct { Appid *string `json:"appid,omitempty"` }
type EntranceFinder struct { FinderId *string `json:"finder_id,omitempty"`; FinderVideoId *string `json:"finder_video_id,omitempty"`; FinderVideoCoverImageUrl *string `json:"finder_video_cover_image_url,omitempty"` }
type CouponCodeMode string; func (e CouponCodeMode) Ptr() *CouponCodeMode { return &e }
const (COUPONCODEMODE_WECHATPAY CouponCodeMode = "WECHATPAY"; COUPONCODEMODE_UPLOAD CouponCodeMode = "UPLOAD")
type CouponCodeCountInfo struct { TotalCount *int64 `json:"total_count,omitempty"`; AvailableCount *int64 `json:"available_count,omitempty"` }
type StockSendRule struct { MaxCount *int64 `json:"max_count,omitempty"`; MaxCountPerDay *int64 `json:"max_count_per_day,omitempty"`; MaxCountPerUser *int64 `json:"max_count_per_user,omitempty"` }
type StockUsageRule struct { CouponAvailablePeriod *CouponAvailablePeriod `json:"coupon_available_period,omitempty"`; NormalCoupon *NormalCouponUsageRule `json:"normal_coupon,omitempty"`; DiscountCoupon *DiscountCouponUsageRule `json:"discount_coupon,omitempty"`; ExchangeCoupon *ExchangeCouponUsageRule `json:"exchange_coupon,omitempty"` }
type StockBundleInfo struct { StockBundleId *string `json:"stock_bundle_id,omitempty"`; StockBundleIndex *int64 `json:"stock_bundle_index,omitempty"` }
type StockSentCountInfo struct { TotalCount *int64 `json:"total_count,omitempty"`; TodayCount *int64 `json:"today_count,omitempty"` }
type StockState string; func (e StockState) Ptr() *StockState { return &e }
const (STOCKSTATE_AUDITING StockState = "AUDITING"; STOCKSTATE_SENDING StockState = "SENDING"; STOCKSTATE_PAUSED StockState = "PAUSED"; STOCKSTATE_STOPPED StockState = "STOPPED"; STOCKSTATE_DEACTIVATED StockState = "DEACTIVATED")
type CouponAvailablePeriod struct { AvailableBeginTime *string `json:"available_begin_time,omitempty"`; AvailableEndTime *string `json:"available_end_time,omitempty"`; AvailableDays *int64 `json:"available_days,omitempty"`; WaitDaysAfterReceive *int64 `json:"wait_days_after_receive,omitempty"`; WeeklyAvailablePeriod *FixedWeekPeriod `json:"weekly_available_period,omitempty"`; IrregularAvailablePeriodList []TimePeriod `json:"irregular_available_period_list,omitempty"` }
type NormalCouponUsageRule struct { Threshold *int64 `json:"threshold,omitempty"`; DiscountAmount *int64 `json:"discount_amount,omitempty"` }
type DiscountCouponUsageRule struct { Threshold *int64 `json:"threshold,omitempty"`; PercentOff *int64 `json:"percent_off,omitempty"` }
type ExchangeCouponUsageRule struct { Threshold *int64 `json:"threshold,omitempty"`; ExchangePrice *int64 `json:"exchange_price,omitempty"` }
type FixedWeekPeriod struct { DayList []WeekEnum `json:"day_list,omitempty"`; DayPeriodList []PeriodOfTheDay `json:"day_period_list,omitempty"` }
type TimePeriod struct { BeginTime *string `json:"begin_time,omitempty"`; EndTime *string `json:"end_time,omitempty"` }
type WeekEnum string; func (e WeekEnum) Ptr() *WeekEnum { return &e }
const (WEEKENUM_MONDAY WeekEnum = "MONDAY"; WEEKENUM_TUESDAY WeekEnum = "TUESDAY"; WEEKENUM_WEDNESDAY WeekEnum = "WEDNESDAY"; WEEKENUM_THURSDAY WeekEnum = "THURSDAY"; WEEKENUM_FRIDAY WeekEnum = "FRIDAY"; WEEKENUM_SATURDAY WeekEnum = "SATURDAY"; WEEKENUM_SUNDAY WeekEnum = "SUNDAY")
type PeriodOfTheDay struct { BeginTime *int64 `json:"begin_time,omitempty"`; EndTime *int64 `json:"end_time,omitempty"` }
