package main

// SDK工具类（HTTP客户端 + 数据模型）见: ../9-SDK工具类/brand_models_and_client.go
// ❗重要：本文件为官方示例代码，只允许替换参数和添加注释，禁止从零编写或拼接修改API路径、签名逻辑、请求结构

import (
	"demo/wxpay_brand_utility" // 引用微信支付工具库
	"encoding/json"
	"fmt"
)

// 创建商品券 - 多次优惠-单品-折扣券
// usage_mode=PROGRESSIVE_BUNDLE, scope=SINGLE, type=DISCOUNT
func main() {
	// TODO: 请准备商户开发必要参数
	config, err := wxpay_brand_utility.CreateBrandConfig(
		"xxxxxxxx",                   // 品牌ID，是由微信支付系统生成并分配给每个品牌方的唯一标识符，品牌ID获取方式参考
		"1DDE55AD98Exxxxxxxxxx",      // 品牌API证书序列号，如何获取请参考品牌经营平台【安全中心】
		"/path/to/apiclient_key.pem", // 品牌API证书私钥文件路径，本地文件路径
		"PUB_KEY_ID_xxxxxxxxxxxxx",   // 微信支付公钥ID，如何获取请参考品牌经营平台【安全中心】
		"/path/to/wxp_pub.pem",       // 微信支付公钥文件路径，本地文件路径
	)
	if err != nil {
		fmt.Println(err)
		return
	}

	request := &CreateProductCouponRequest{
		OutRequestNo: wxpay_brand_utility.String("PROGRESSIVE_BUNDLE_SINGLE_DISCOUNT_20250101_003"), // 必填，创建请求单号，6-40个字符
		Scope:        PRODUCTCOUPONSCOPE_SINGLE.Ptr(),                                       // 必填，优惠范围：SINGLE-单品券
		Type:         PRODUCTCOUPONTYPE_DISCOUNT.Ptr(),                                      // 必填，商品券类型：DISCOUNT-折扣券
		UsageMode:    USAGEMODE_PROGRESSIVE_BUNDLE.Ptr(),                                            // 必填，使用模式：PROGRESSIVE_BUNDLE-多次优惠
		// 必填，多次优惠模式信息(当usage_mode=PROGRESSIVE_BUNDLE时必填)
		ProgressiveBundleUsageInfo: &ProgressiveBundleUsageInfo{
			Count:        wxpay_brand_utility.Int64(5), // 必填，可使用次数，最少3次，最多15次
			IntervalDays: wxpay_brand_utility.Int64(1), // 选填，每次优惠间隔天数，最少0天，最多7天
		},
		// 必填，商品券展示信息
		DisplayInfo: &ProductCouponDisplayInfo{
			Name:          wxpay_brand_utility.String("单品折扣券-可乐5次优惠"),                       // 必填，商品券名称，最多12个字符
			ImageUrl:      wxpay_brand_utility.String("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"), // 必填，商品券图片URL
			BackgroundUrl: wxpay_brand_utility.String("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"), // 选填，背景图URL
			DetailImageUrlList: []string{ // 选填，详情图URL列表，最多6张
				"https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx",
			},
			OriginalPrice: wxpay_brand_utility.Int64(500), // 必填(单品券)，商品原价(单位：分)
			// 必填(单品券)，套餐组合列表
			ComboPackageList: []ComboPackage{
				{
					Name:      wxpay_brand_utility.String("超值套餐"), // 必填，套餐名称
					PickCount: wxpay_brand_utility.Int64(1),       // 必填，可选商品数量
					// 必填，可选商品列表
					ChoiceList: []ComboPackageChoice{
						{
							Name:             wxpay_brand_utility.String("可乐"),                                       // 必填，商品名称
							Price:            wxpay_brand_utility.Int64(500),                                          // 必填，商品价格(单位：分)
							Count:            wxpay_brand_utility.Int64(1),                                            // 必填，商品数量
							ImageUrl:         wxpay_brand_utility.String("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"), // 必填，商品图片URL
							MiniProgramAppid: wxpay_brand_utility.String("wx1234567890"),                              // 选填，跳转小程序AppID
							MiniProgramPath:  wxpay_brand_utility.String("/pages/index/product"),                      // 选填，跳转小程序路径
						},
					},
				},
			},
		},
		OutProductNo: wxpay_brand_utility.String("Product_ProgressiveBundle_003"), // 选填，商户侧商品券唯一标识
		// 必填，批次信息
		StockBundle: &StockForCreate{
			Remark:         wxpay_brand_utility.String("单品折扣券批次"), // 选填，批次备注，最多60个字符
			CouponCodeMode: COUPONCODEMODE_WECHATPAY.Ptr(),          // 必填，券码模式：WECHATPAY/UPLOAD/API_ASSIGN
			// 必填，批次发放规则
			StockSendRule: &StockSendRule{
				MaxCount:        wxpay_brand_utility.Int64(10000000), // 必填，批次最大发放数量
				MaxCountPerDay:  wxpay_brand_utility.Int64(100000),   // 选填，单日最大发放数量
				MaxCountPerUser: wxpay_brand_utility.Int64(1),        // 必填，单用户最大领取数量
			},
			// 必填，多次优惠使用规则(当usage_mode=PROGRESSIVE_BUNDLE时必填)
			ProgressiveBundleUsageRule: &ProgressiveBundleUsageRule{
				// 必填，券可核销时间
				CouponAvailablePeriod: &CouponAvailablePeriod{
					AvailableBeginTime:   wxpay_brand_utility.String("2025-08-01T00:00:00+08:00"), // 必填，可用开始时间(RFC3339格式)
					AvailableEndTime:     wxpay_brand_utility.String("2025-12-31T23:59:59+08:00"), // 必填，可用结束时间(RFC3339格式)
					AvailableDays:        wxpay_brand_utility.Int64(30),                           // 选填，多次优惠有效天数，最少3天，最多365天
					WaitDaysAfterReceive: wxpay_brand_utility.Int64(0),                            // 选填，领取后N天生效，最少0天，最多30天
					IntervalDays:         wxpay_brand_utility.Int64(1),                            // 选填，使用间隔天数，最少0天，最多7天
					// 选填，每周固定可用时间
					WeeklyAvailablePeriod: &FixedWeekPeriod{
					DayList: []WeekEnum{ // 条件必填，每周可用星期数（此示例仅工作日可用）
						WEEKENUM_MONDAY,
						WEEKENUM_TUESDAY,
						WEEKENUM_WEDNESDAY,
						WEEKENUM_THURSDAY,
						WEEKENUM_FRIDAY,
					},
					},
					// 选填，不规则可用时间段列表
					IrregularAvailablePeriodList: []TimePeriod{
						{
							BeginTime: wxpay_brand_utility.String("2025-10-01T00:00:00+08:00"), // 必填，开始时间(RFC3339格式)
							EndTime:   wxpay_brand_utility.String("2025-10-07T23:59:59+08:00"), // 必填，结束时间(RFC3339格式)
						},
					},
				},
				SpecialFirst: wxpay_brand_utility.Bool(false), // 选填，首次优惠是否特殊
				// 条件必填，折扣券使用规则列表(当type=DISCOUNT时必填，数量需与count一致)
				DiscountCouponList: []DiscountCouponUsageRule{
					{Threshold: wxpay_brand_utility.Int64(0), PercentOff: wxpay_brand_utility.Int64(10)}, // 必填: Threshold-门槛金额, PercentOff-折扣百分比
					{Threshold: wxpay_brand_utility.Int64(0), PercentOff: wxpay_brand_utility.Int64(15)},
					{Threshold: wxpay_brand_utility.Int64(0), PercentOff: wxpay_brand_utility.Int64(20)},
					{Threshold: wxpay_brand_utility.Int64(0), PercentOff: wxpay_brand_utility.Int64(25)},
					{Threshold: wxpay_brand_utility.Int64(0), PercentOff: wxpay_brand_utility.Int64(30)},
				},
			},
			// 必填，使用规则展示信息
			UsageRuleDisplayInfo: &UsageRuleDisplayInfo{
				CouponUsageMethodList: []CouponUsageMethod{ // 必填，核销方式列表
					COUPONUSAGEMETHOD_OFFLINE,      // 线下核销
					COUPONUSAGEMETHOD_MINI_PROGRAM, // 小程序核销
					COUPONUSAGEMETHOD_APP,          // APP核销
					COUPONUSAGEMETHOD_PAYMENT_CODE, // 付款码核销
				},
				MiniProgramAppid: wxpay_brand_utility.String("wx1234567890"),        // 条件必填，支持小程序核销时必填
				MiniProgramPath:  wxpay_brand_utility.String("/pages/index/product"), // 条件必填，支持小程序核销时必填
				AppPath:          wxpay_brand_utility.String("pages/index/product"),  // 条件必填，支持APP核销时必填
				UsageDescription: wxpay_brand_utility.String("指定商品可用，多次递增优惠"),       // 选填，使用说明
				// 选填，可用门店信息
				CouponAvailableStoreInfo: &CouponAvailableStoreInfo{
					Description:      wxpay_brand_utility.String("所有门店可用"),              // 选填，可用门店描述
					MiniProgramAppid: wxpay_brand_utility.String("wx1234567890"),          // 选填，门店小程序AppID
					MiniProgramPath:  wxpay_brand_utility.String("/pages/index/store-list"), // 选填，门店小程序路径
				},
			},
			// 必填，用户券展示信息
			CouponDisplayInfo: &CouponDisplayInfo{
				CodeDisplayMode: COUPONCODEDISPLAYMODE_QRCODE.Ptr(),      // 必填，券码展示模式：INVISIBLE/BARCODE/QRCODE
				BackgroundColor: wxpay_brand_utility.String("Color010"), // 选填，背景颜色
				// 选填，小程序入口
				EntranceMiniProgram: &EntranceMiniProgram{
					Appid:           wxpay_brand_utility.String("wx1234567890"),         // 必填，小程序AppID
					Path:            wxpay_brand_utility.String("/pages/index/product"), // 必填，小程序路径
					EntranceWording: wxpay_brand_utility.String("立即使用"),                 // 必填，入口文案
					GuidanceWording: wxpay_brand_utility.String("多次优惠等你来"),               // 选填，引导文案
				},
				// 选填，公众号入口
				EntranceOfficialAccount: &EntranceOfficialAccount{
					Appid: wxpay_brand_utility.String("wx1234567890"), // 必填，公众号AppID
				},
				// 选填，视频号入口
				EntranceFinder: &EntranceFinder{
					FinderId:                 wxpay_brand_utility.String("gh_12345678"),                             // 必填，视频号ID
					FinderVideoId:            wxpay_brand_utility.String("UDFsdf24df34dD456Hdf34"),                  // 选填，视频号视频ID
					FinderVideoCoverImageUrl: wxpay_brand_utility.String("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"), // 选填，视频封面图URL
				},
			},
			// 选填，事件通知配置
			NotifyConfig: &NotifyConfig{
				NotifyAppid: wxpay_brand_utility.String("wx4fd12345678"), // 必填，通知AppID
			},
			StoreScope: STOCKSTORESCOPE_NONE.Ptr(), // 必填，门店适用范围：NONE-不限制/ALL-全部门店/SPECIFIC-指定门店
		},
	}

	response, err := CreateProductCoupon(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		return
	}

	fmt.Printf("请求成功: %+v\n", response)
}
