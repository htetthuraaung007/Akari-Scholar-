import React, { useState } from 'react';

export interface FaqItem {
  id: number;
  question: string;
  answer: string;
}

export const FAQ_DATA: FaqItem[] = [
  {
    "id": 1,
    "question": "University of the People (UoPeople) ရဲ့ ဘွဲ့လက်မှတ်က တကယ်ရော တရားဝင် အသိအမှတ်ပြုမှု ရှိပါသလား။",
    "answer": "အပြည့်အဝ ရှိပါတယ်။ UoPeople ဟာ အမေရိကန်ရဲ့ ထိပ်တန်း Regional Accreditation အဖွဲ့အစည်းကြီးတစ်ခုဖြစ်တဲ့ WASC ရဲ့ တရားဝင် အသိအမှတ်ပြုမှုကို ရရှိထားတာ ဖြစ်ပါတယ်။ WASC ဆိုတာ Stanford တို့၊ UC Berkeley တို့လို ကမ္ဘာကျော် တက္ကသိုလ်ကြီးတွေကို စံချိန်စံညွှန်းစစ်ဆေး အသိအမှတ်ပြုပေးထားတဲ့ အဖွဲ့အစည်းကြီးပါ။ ဒါကြောင့် UoPeople ရဲ့ သင်ရိုးညွှန်းတမ်းတွေ၊ ဆရာတွေရဲ့ အရည်အချင်းနဲ့ စနစ်တစ်ခုလုံးဟာ ကမ္ဘာ့စံချိန်စံညွှန်းမီကြောင်း အာမခံချက်ရှိပြီး၊ ဒီကရတဲ့ ဘွဲ့လက်မှတ်နဲ့ နောက်ထပ် Master Degree တွေကိုလည်း နိုင်ငံတကာမှာ ဆက်လက် လျှောက်ထားနိုင်ပါတယ်။"
  },
  {
    "id": 2,
    "question": "ဘွဲ့ရပြီး နိုင်ငံတကာမှာ ကျောင်းဆက်တက်ဖို့ Attestation နဲ့ Apostille ဆိုတာ ဘာလဲ၊ ဘာတွေ ကွာခြားပါသလဲ။",
    "answer": "Accreditation ဆိုတာ တက္ကသိုလ်ရဲ့ ပညာရေး အရည်အသွေးကို စစ်ဆေး အသိအမှတ်ပြုတာဖြစ်ပြီး၊ Attestation ဒါမှမဟုတ် Apostille ဆိုတာကတော့ ထုတ်ပေးလိုက်တဲ့ ဘွဲ့လက်မှတ် အစစ်အမှန်ဖြစ်ကြောင်း အစိုးရချင်း ဥပဒေကြောင်းအရ တရားဝင်အောင် လုပ်ဆောင်ပေးတဲ့ လုပ်ငန်းစဉ် ဖြစ်ပါတယ်။ ဥရောပနိုင်ငံ အများစုလို Hague Convention ထဲပါတဲ့ နိုင်ငံတွေမှာ ကျောင်းဆက်တက်မယ်ဆိုရင် Accreditation ရှိရုံနဲ့ မလုံလောက်ဘဲ US State Department ကနေ Apostille တံဆိပ် ယူရပါမယ်။ ဒါပေမဲ့ ကိုယ်သွားမယ့်နိုင်ငံက Hague Convention ထဲ မပါဝင်ဘူးဆိုရင်တော့ ဒီအဆင့်တွေ လိုက်လုပ်စရာ မလိုပါဘူး။"
  },
  {
    "id": 3,
    "question": "Apostille နဲ့ WES Evaluation အတွက် စာရွက်စာတမ်းတွေကို ဘယ်လိုနည်းလမ်းတွေနဲ့ လုပ်ဆောင်ရမလဲ။",
    "answer": "UoPeople ကနေ တိုက်ရိုက် လျှောက်ထားနိုင်သလို Scholaro၊ US Authentication Services ဒါမှမဟုတ် Monument Visa စတဲ့ ပြင်ပ အေဂျင်စီတွေကနေတစ်ဆင့်လည်း လုပ်ဆောင်နိုင်ပါတယ်။ စာရွက်စာတမ်း အသစ်လိုချင်ရင် ကျောင်း Portal ကနေ Duplicate Documents အသစ်မှာယူပြီး Shipping Address နေရာမှာ ကိုယ့်လိပ်စာအစား အမေရိကန်က Agency ရဲ့ လိပ်စာကို ထည့်ပေးလိုက်တာ ပိုလွယ်ကူပါတယ်။ အေဂျင်စီကနေ California Notary Public၊ County Clerk နဲ့ Secretary of State Apostille အဆင့်သုံးဆင့်လုံး ဆောင်ရွက်ပေးပြီး ကိုယ့်ဆီ ဒါမှမဟုတ် ဥရောပက ကျောင်းဆီ DHL နဲ့ ပြန်ပို့ပေးပါလိမ့်မယ်။ သို့သော်လည်း ငွေမကုန်ခင် ကိုယ်တက်မယ့်ကျောင်းက Apostille ရော WES ရော တကယ် လိုအပ်ခြင်း ရှိမရှိ အရင်ဆုံး သေချာ စုံစမ်းစစ်ဆေးထားသင့်ပါတယ်။"
  },
  {
    "id": 4,
    "question": "UoPeople မှာ ဘွဲ့ရဖို့ ဘာသာရပ်ရွေးချယ်တဲ့အခါ Associate Degree နဲ့ Bachelor Degree ဘာကွာခြားပြီး ဘယ်ဟာကို ရွေးသင့်သလဲ။",
    "answer": "Associate Degree ဆိုတာ ပုံမှန်တက်ရင် ၂ နှစ် ကြာမြင့်ပြီး UK ပညာရေးစနစ်က HND လို အဆင့်မျိုး ဖြစ်ပါတယ်။ Bachelor Degree ကတော့ ဘွဲ့အပြည့်အဝရတဲ့ ၄ နှစ်သင်တန်း ဖြစ်ပါတယ်။ Associate ကနေ အခြား တက္ကသိုလ်တွေကို ပြောင်းရွှေ့လျှောက်ထားဖို့ဆိုတာ အဆင့်ဆင့် လုပ်ဆောင်ရတာတွေ အရမ်းများသလို သက်ဆိုင်ရာကျောင်းတွေဆီကိုလည်း အသေးစိတ် ကြိုတင် မေးမြန်းစုံစမ်းရပါတယ်။ ဒါကြောင့် ကိုယ့်ဘက်က အချိန်ပေးနိုင်တယ်ဆိုရင် Bachelor Degree ကိုသာ ရွေးချယ်ပြီး တိုက်ရိုက် တက်ရောက်တာ အကောင်းဆုံး ဖြစ်ပါတယ်။"
  },
  {
    "id": 5,
    "question": "ကျောင်းစလျှောက်တော့မယ်ဆိုရင် ဘာတွေ လိုအပ်ပြီး English Proficiency ကို ဘယ်လို ကျော်လွှားနိုင်မလဲ။",
    "answer": "UoPeople ဝင်ခွင့်အတွက် သီးသန့် Test ဖြေဆိုစရာ မလိုပါဘူး။ ဆယ်တန်းအောင်လက်မှတ်နဲ့ အမှတ်စာရင်းကို နိုထရီပြန်ထားတာ ဒါမှမဟုတ် GED ရှိရင် လျှောက်ထားနိုင်ပါတယ်။ အင်္ဂလိပ်စာအတွက်ကတော့ EF SET ရဲ့ မိနစ် ၅၀ စာမေးပွဲကို ဖြေဆိုပြီး အနည်းဆုံး Upper Intermediate ဒါမှမဟုတ် C1 အဆင့်ရရင် English Course တွေကို ကျော်လွှားခွင့် ရရှိနိုင်ပါတယ်။ ဒါ့အပြင် တရားဝင် အသိအမှတ်ပြု BTEC HND လိုမျိုး Transcript အထောက်အထား ရှိရင်လည်း တင်ပြပြီး English Composition 1 အထိ ကင်းလွတ်ခွင့် ရရှိနိုင်ပါတယ်။"
  },
  {
    "id": 6,
    "question": "ကျောင်းစတင် လျှောက်ထားတဲ့အခါ အမည်စာရင်း (Name Formatting) ဖြည့်သွင်းရာမှာ ဘာတွေ သတိပြုရမလဲ။",
    "answer": "အကောင့်ဖွင့်တဲ့အခါ First Name နဲ့ Last Name နေရာ နှစ်ခုတည်းမှာသာ ခွဲခြား ဖြည့်သွင်းတာ အသင့်တော်ဆုံး ဖြစ်ပါတယ်။ ဥပမာ First Name နေရာမှာ Thin Yati လို့ ထည့်ပြီး Last Name နေရာမှာ Tun လို့ ထည့်လိုက်ရင် Dear Thin Yati Tun ဆိုပြီး ပေါ်လာမှာ ဖြစ်သလို Portal မှာလည်း နာမည်အပြည့်အစုံ ပေါ်နေမှာပါ။ အကယ်၍ First Name မှာ Thin၊ Middle Name မှာ Yati၊ Last Name မှာ Tun လို့ သုံးပိုင်း ခွဲထည့်လိုက်ရင် စနစ်က Middle Name ကို ဖျောက်ထားတတ်တာကြောင့် Dear Thin Tun ဆိုပြီး ပေါ်နေတတ်ပါတယ်။ စောကလျာထူး ဆိုတဲ့ နာမည်မျိုးမှာလည်း First, Middle, Last ခွဲလိုက်ရင် စောထူး ဆိုပြီး ဖြစ်သွားတတ်တာကြောင့် Passport စာအုပ်ထဲက အချက်အလက်အတိုင်း တိတိကျကျ မှန်ကန်အောင် ဖြည့်သွင်းရပါမယ်။"
  },
  {
    "id": 7,
    "question": "ကျောင်းစလျှောက်တဲ့ အဆင့်မှာ စာရွက်စာတမ်း အားလုံးကို ချက်ချင်း အကုန်တင်ဖို့ လိုအပ်ပါသလား။",
    "answer": "ချက်ချင်း အကုန်တင်စရာ မလိုသေးပါဘူး။ ကျောင်းလျှောက်တဲ့ အဆင့်မှာ ကိုယ်ရေးအချက်အလက်တွေ ဖြည့်ပြီးတဲ့အခါ အင်္ဂလိပ်စာ စာမေးပွဲ ရလဒ်ကိုပဲ Admissions နေရာမှာ အရင် တင်ထားလို့ ရပါတယ်။ ဆယ်တန်းအောင်လက်မှတ်၊ အမှတ်စာရင်း မူရင်းပုံနှစ်ခုနဲ့ နိုထရီပြန်ထားတဲ့ပုံနှစ်ခု စတာတွေကိုတော့ ပထမအဆင့်မှာ မတင်သေးဘဲ ထားနိုင်ပါတယ်။ စကောလားရှစ် ရမရ အခြေအနေကို စောင့်ကြည့်ပြီးမှသာ သတ်မှတ်ထားတဲ့ Academic Calendar ရက်မတိုင်ခင် Portal ထဲ အေးဆေး ဝင်တင်တာက ပိုမို အဆင်ပြေစေပါတယ်။"
  },
  {
    "id": 8,
    "question": "မြန်မာနိုင်ငံကနေ လျှောက်ထားရင် Scholarship ရနိုင်သလား၊ ဘယ်လို လျှောက်ရမလဲ။",
    "answer": "မြန်မာနိုင်ငံက လျှောက်ထားသူတွေအတွက် Application Fee ရော Course Assessment Fee ပါ အပြည့်နီးပါး ထောက်ပံ့ပေးလေ့ ရှိပါတယ်။ လျှောက်လွှာဖြည့်တဲ့အခါ ကိုယ့်မှာ ဘာကြောင့် ဒီထောက်ပံ့ကြေး လိုအပ်ရသလဲဆိုတဲ့ အကြောင်းပြချက်ကို သတ်မှတ်ထားတဲ့ စာလုံးရေအတွင်း သေသေချာချာ ရေးသားပြနိုင်ရင် မိနစ်ပိုင်းကနေ နာရီပိုင်းအတွင်း စကောလားရှစ် ရရှိကြောင်း အီးမေးလ် ရောက်ရှိလာတတ်ပါတယ်။ ပုံမှန်အားဖြင့် တစ်ကြိမ်လျှောက်ရင် ၅ ဘာသာစာ အခမဲ့တက်ခွင့် ရရှိမှာ ဖြစ်ပါတယ်။"
  },
  {
    "id": 9,
    "question": "ပထမတစ်ကြိမ် ရထားတဲ့ Scholarship ၅ ဘာသာ ကုန်သွားရင် နောက်ထပ် ဘာသာရပ်တွေအတွက် ဘယ်လို ဆက်လျှောက်ရမလဲ၊ အငြင်းခံရရင် ဘာလုပ်ရမလဲ။",
    "answer": "ပထမ ရထားတဲ့ ၅ ဘာသာ ကုန်ခါနီးတဲ့အခါ ကိုယ့်ရဲ့ CGPA အခြေအနေနဲ့ လက်ရှိ ကြုံတွေ့နေရတဲ့ အခက်အခဲတွေကို အသေးစိတ် ချိတ်ဆက် ရေးသားပြီး Program Advisor ဆီ အီးမေးလ် ပို့ရပါမယ်။ အဲ့ဒီအခါ Advisor က Portal မှာ Form ဖွင့်ပေးမှာဖြစ်ပြီး အဲ့ဒီကတစ်ဆင့် Reapply လုပ်ရပါတယ်။ တကယ်လို့ စကောလားရှစ် လျှောက်ထားမှု အငြင်းခံရတယ်ဆိုရင်လည်း လုံးဝ လက်မလျှော့ဘဲ ကိုယ့်ရဲ့ Program Advisor ကိုပဲ အခြေအနေမှန်တွေကို သေချာ ရှင်းပြပြီး မရမက မေတ္တာရပ်ခံ တင်ပြရပါမယ်။ Advisor ဟာ ဒီနေရာမှာ အဓိက အကျဆုံး ပုဂ္ဂိုလ် ဖြစ်ပါတယ်။"
  },
  {
    "id": 10,
    "question": "Master Degree တွေအတွက် ကျောင်းဘက်ကနေ တိုက်ရိုက် စကောလားရှစ် ပေးပါသလား။",
    "answer": "UoPeople ဟာ Bachelor ဒီဂရီတွေလို Master Degree တွေအတွက် ကျောင်းဘက်ကနေ တိုက်ရိုက် Scholarship အပြည့် ပေးအပ်ခြင်း မရှိပါဘူး။ အကယ်၍ Master of Education (M.Ed) တက်ရောက်လိုတယ်ဆိုရင် IB (International Baccalaureate) ကနေတစ်ဆင့် လျှောက်ထားနိုင်သလို၊ တခြားသော Master ဘာသာရပ်တွေအတွက်ဆိုရင် Prospect Burma လို ပြင်ပ ပညာသင်ဆု အဖွဲ့အစည်းတွေဆီကနေတစ်ဆင့် လျှောက်ထား ရယူရတာ ဖြစ်ပါတယ်။"
  },
  {
    "id": 11,
    "question": "ကျောင်းတက်နေစဉ် ပြဿနာကြုံလာရင် ဘယ်လို ဆက်သွယ် မေးမြန်းရမလဲ။",
    "answer": "အွန်လိုင်းတက္ကသိုလ် ဖြစ်တဲ့အတွက် Program Advisor ဆီ စာပို့တဲ့အခါ ပြန်စာရဖို့ အနည်းဆုံး ၂ ရက်ကနေ ၃ ရက်အထိ ကြာတတ်ပါတယ်။ ဒီထက်ပိုကြာသွားရင်တော့ ပို့ထားတဲ့ အီးမေးလ်မှာပဲ Follow-up ထပ်မေးရပါမယ်။ အကယ်၍ ချက်ချင်း အရေးတကြီး စာပြန်လိုတယ်ဆိုရင်တော့ အီးမေးလ်ထက် Student Portal ထဲက Chatbot ကနေတစ်ဆင့် ဒါမှမဟုတ် UoPeople ရဲ့ Messenger ကနေတစ်ဆင့် Live Chat ပြောတာက ရုံးချိန်အတွင်းဆိုရင် ချက်ချင်း စာပြန်တာမို့ ပိုပြီး လျင်မြန်ပါတယ်။"
  },
  {
    "id": 12,
    "question": "UoPeople ရဲ့ သက်ဆိုင်ရာ ဌာနအသီးသီးဆီ တိုက်ရိုက် ဆက်သွယ်နိုင်တဲ့ အီးမေးလ်လိပ်စာတွေက ဘာတွေလဲ။",
    "answer": "ကျောင်းပြီးဆုံးသူများအတွက် Alumni Office က alumni@uopeople.edu ဖြစ်ပြီး၊ အလုပ်အကိုင် အခွင့်အလမ်းအတွက် Career Service Center က career.services@uopeople.edu ဖြစ်ပါတယ်။ စကောလားရှစ်နဲ့ ငွေကြေးဆိုင်ရာများအတွက် Financial Aid Office က financial.aid@uopeople.edu နဲ့ Payments Office က payments@uopeople.edu တို့ ဖြစ်ပါတယ်။ အလုပ်သင်ကိစ္စများအတွက် internships@uopeople.edu၊ စာကြည့်တိုက်အတွက် library@uopeople.edu၊ ပညာရေးဆိုင်ရာ ကိစ္စများအတွက် academic.affairs@uopeople.edu နဲ့ ကျောင်းဝင်ခွင့်အတွက် admissions@uopeople.edu တို့ဆီ စာပို့နိုင်ပါတယ်။ ကျောင်းသားရေးရာအတွက် student.affairs@uopeople.edu နဲ့ ဝန်ဆောင်မှုအတွက် student.services@uopeople.edu၊ ပြင်ပဆက်ဆံရေးအတွက် outreach@uopeople.edu၊ သင်ကြားရေးအကြံပေး Program Advising အတွက် advising@uopeople.edu နဲ့ Moodle နည်းပညာအခက်အခဲများအတွက် support@uopeople.edu တို့ဆီ တိုက်ရိုက် ဆက်သွယ်နိုင်ပါတယ်။"
  },
  {
    "id": 13,
    "question": "Student Portal ထဲမှာ ခွင့်တိုင်တာ (LOA)၊ Scholarship ပြန်လျှောက်တာနဲ့ Major ပြောင်းတာတွေကို ဘယ်နေရာမှာ လုပ်ဆောင်ရမလဲ။",
    "answer": "portal.uopeople.edu/login လင့်ခ်ကနေတစ်ဆင့် အကောင့်ထဲ ဝင်ရောက်ရပါတယ်။ အကယ်၍ အလုပ်မအားလို့ဖြစ်စေ၊ အကြောင်းအမျိုးမျိုးကြောင့်ဖြစ်စေ ကျောင်းခေတ္တ နားချင်ရင် နောက် Term မစတင်မီ Self-Service Forms ကဏ္ဍအောက်မှာ ပေါ်လာမယ့် LOA (Leave of Absence) နေရာကို နှိပ်ပြီး တရားဝင် ခွင့်တိုင်ကြားနိုင်ပါတယ်။ စကောလားရှစ် သက်တမ်းတိုးတာ ဒါမှမဟုတ် ဘာသာရပ်ကြေး ကုန်ခါနီးလို့ ထပ်မံ လျှောက်ထားတာတွေကိုလည်း ဒီ Scholarship Request Forms ထဲမှာပဲ လုပ်ဆောင်ရပါတယ်။ အကယ်၍ Major ပြောင်းချင်တာ ဒါမှမဟုတ် တခြား ကိစ္စတွေ လျှောက်ထားချင်ရင်လည်း Self-Service Forms မှာပဲ လုပ်ဆောင်ရပြီး ကိုယ့်ရဲ့ ပညာရေး ခရီးစဉ်ကို ပြန်ကြည့်ချင်ရင်တော့ My Academic Progress အောက်က Degree Audit Report ထဲမှာ ဝင်ရောက် စစ်ဆေးနိုင်ပါတယ်။ ဘာသာစကား အခက်အခဲရှိရင် သက်ဆိုင်ရာ စာမျက်နှာကို Screenshot ရိုက်ပြီး AI ဆီမှာ မြန်မာလို အလွယ်တကူ ဘာသာပြန်ခိုင်းပြီး လေ့လာနိုင်ပါတယ်။"
  },
  {
    "id": 14,
    "question": "Foundation Course တွေ အောင်မြင်ပြီး တရားဝင် Degree-Seeking Student ဖြစ်သွားရင် ဘာအခွင့်အရေးတွေ ရရှိလာမလဲ။",
    "answer": "Foundation Course တွေ ပြီးဆုံးသွားတာနဲ့ ကျောင်းဘက်ကနေ ကိုယ့်နာမည်နဲ့ uopeople.edu အဆုံးသတ်တဲ့ တရားဝင် ကျောင်းသား အီးမေးလ်အကောင့်နဲ့ Microsoft 365 Account ကို အခမဲ့ ထုတ်ပေးပါတယ်။ ဒီ ကျောင်းသား .edu အီးမေးလ်ကို သုံးပြီး ပညာရေးဆိုင်ရာ လျှော့ဈေး အခွင့်အရေးတွေ ရယူနိုင်သလို GitHub Copilot ကိုလည်း အခမဲ့ လျှောက်ထား အသုံးပြုနိုင်ပါတယ်။ တခြားသော ကျောင်းသား သီးသန့် အကျိုးခံစားခွင့် ဝန်ဆောင်မှုတွေကိုလည်း ဒီ အီးမေးလ်နဲ့ စမ်းသပ် ချိတ်ဆက် သုံးစွဲနိုင်ပါတယ်။"
  },
  {
    "id": 15,
    "question": "UoPeople မှာ စာသင်နှစ် တစ်နှစ်ကို ဘယ်လို ခွဲခြားထားပြီး စာသင်ချိန် အချိန်သတ်မှတ်ချက်တွေက ဘယ်လိုရှိပါသလဲ။",
    "answer": "တစ်နှစ်မှာ Term ပေါင်း ၅ ခု ရှိပါတယ်။ Term တစ်ခုဟာ ၉ ပတ် ကြာမြင့်ပြီး ပထမ ၈ ပတ်က စာသင်တာ၊ Discussion လုပ်တာ၊ Assignment ရေးတာတွေ ဖြစ်ပြီး နောက်ဆုံး ၉ ပတ်မြောက်မှာ Final စာမေးပွဲ ဖြေဆိုရပါတယ်။ ပုံမှန်အားဖြင့် စာသင်ပတ်တစ်ခုဟာ UoPeople စံတော်ချိန် ကြာသပတေးနေ့ မနက် ၁၂ နာရီမှာ စတင်ပြီး နောက်တစ်ပတ် ဗုဒ္ဓဟူးနေ့ ည ၁၁ နာရီ ၂၅ မိနစ်မှာ ပြီးဆုံးပါတယ်။ ဒါဟာ မြန်မာစံတော်ချိန်နဲ့ဆိုရင် ကြာသပတေးနေ့ မနက် ၁၁ နာရီခွဲမှာ စတင်ပြီး နောက်တစ်ပတ် ကြာသပတေးနေ့ မနက် ၁၁ နာရီ ၂၅ မိနစ်မှာ အဆုံးသတ်တာ ဖြစ်ပါတယ်။"
  },
  {
    "id": 16,
    "question": "Academic Calendar ထဲက First Day of the Term နဲ့ Course Drop Period ဆိုတာ ဘာတွေလဲ။",
    "answer": "First Day of the Term ဆိုတာ သက်ဆိုင်ရာ Term တစ်ခုရဲ့ စာသင်ကြားမှု တရားဝင် စတင်တဲ့ ပထမဆုံးနေ့ ဖြစ်ပါတယ်။ Course Drop Period ဆိုတာကတော့ ကိုယ်ရွေးချယ်ထားတဲ့ ဘာသာရပ်တစ်ခုကို အချိန်မရတာ ဒါမှမဟုတ် မလိုက်နိုင်တာကြောင့် နားချင်တဲ့အခါ အဲ့ဒီ Term ရဲ့ ပထမဆုံး အပတ်အတွင်း စာရင်းကနေ ပယ်ဖျက်ခွင့်ပြုတဲ့ ကာလ ဖြစ်ပါတယ်။ ဒီကာလအတွင်း Drop လုပ်လိုက်ရင် ကျောင်းမှတ်တမ်း Transcript ပေါ်မှာ ဘာ အမှတ်အသားမှ မကျန်ရစ်ဘဲ သန့်ရှင်းစွာ ပယ်ဖျက်ပြီးသား ဖြစ်သွားပါတယ်။"
  },
  {
    "id": 17,
    "question": "Course Withdrawal Period ဆိုတာ ဘာလဲ၊ ဘာကြောင့် လုပ်သင့်ပြီး Transcript မှာ W ပေါ်ရင် ထိခိုက်မှု ရှိပါသလား။",
    "answer": "Term တစ်ခုရဲ့ ဒုတိယအပတ်ကနေ စတုတ္ထအပတ်အတွင်း မကျန်းမာတာ ဒါမှမဟုတ် အရေးပေါ် လူမှုရေးကိစ္စတွေကြောင့် စာဆက်မလိုက်နိုင်တဲ့အခါ ဘာသာရပ်ကို ရုပ်သိမ်းခွင့်ပြုတဲ့ ကာလ ဖြစ်ပါတယ်။ ဒါဟာ မလိုက်နိုင်တဲ့ကြားက အတင်းဇွတ်တက်ပြီး CGPA ကျဆင်းသွားမယ့် ဘေးကနေ ကျောင်းသားကို ကာကွယ်ပေးထားတဲ့ ထွက်ပေါက်တစ်ခု ဖြစ်ပါတယ်။ Withdrawal လုပ်လိုက်ရင် Transcript မှာ W လို့ အမှတ်အသား ပေါ်သွားမှာ ဖြစ်ပေမယ့် UoPeople ရဲ့ လက်ရှိ Scholarship ကို လုံးဝ မထိခိုက်ပါဘူး။ နောင်တစ်ချိန် Master လျှောက်တဲ့အခါ ဒီ W အမှတ်အသား ပါနေလို့ စိုးရိမ်ရတယ်ဆိုရင်တောင် အဲ့ဒီအချိန်မှာ ကြုံတွေ့ခဲ့ရတဲ့ အခက်အခဲတွေကို ဘယ်လို ကျော်ဖြတ်ခဲ့ရသလဲဆိုတာ SOP (Statement of Purpose) ထဲမှာ အကြောင်းပြချက် ခိုင်လုံစွာ ရှင်းပြပြီး ချေဖျက်နိုင်ပါတယ်။ သို့သော် Term ၅ ခု ဆက်တိုက် ဘာသာရပ်တစ်ခုမှ မယူဘဲ နေလိုက်ရင်တော့ ကျောင်းကနေ အကောင့်ကို အပြီးပိတ် Inactive လုပ်ပစ်တတ်တာကို သတိပြုရပါမယ်။"
  },
  {
    "id": 18,
    "question": "Course Registration Period နဲ့ Late Registration ဆိုတာ ဘာတွေလဲ၊ အသစ်တက်မယ့်သူတွေရော ဘာလုပ်ရမလဲ။",
    "answer": "Course Registration Period ဆိုတာ လက်ရှိတက်နေတဲ့ Term ရဲ့ ၅ ပတ်မြောက်ကနေ ၇ ပတ်မြောက်အတွင်း နောက်လာမယ့် Term အသစ်အတွက် ဘာသာရပ်တွေကို ကြိုတင် စာရင်းသွင်း ရွေးချယ်ရတဲ့ ကာလ ဖြစ်ပါတယ်။ ပထမဆုံး စတင်တက်ရောက်မယ့် ကျောင်းသားအသစ်တွေအတွက်ကတော့ ကျောင်းဘက်ကနေ အလိုအလျောက် ၁ ဘာသာ ဒါမှမဟုတ် ၂ ဘာသာ ကြိုတင် စာရင်းသွင်းပေးထားပြီး ဖြစ်ပါတယ်။ အကယ်၍ သတ်မှတ်ကာလအတွင်း အကြောင်းအမျိုးမျိုးကြောင့် စာရင်းမသွင်းလိုက်နိုင်ရင် Term အသစ် မစတင်မီ တစ်ပတ်အလိုမှာ Late Registration ကာလအဖြစ် ထပ်မံ ဖွင့်လှစ်ပေးပါတယ်။ သို့သော်လည်း ဘာသာရပ်တွေဟာ လူဦးရေ ကန့်သတ်ချက် ပြည့်သွားတတ်တာကြောင့် ဦးရာလူစနစ် ဖြစ်ပြီး စောစော စာရင်းသွင်းထားတာ ပိုမို စိတ်ချရပါတယ်။"
  },
  {
    "id": 19,
    "question": "ဘွဲ့ရဖို့ ဘယ်နှစ်ဘာသာ ကျန်သေးလဲဆိုတာနဲ့ ဘာသာရပ်အသစ်တွေကို UoPeople ရဲ့ Learning Pathway စနစ်အရ ဘယ်လို စီစဉ် ရွေးချယ်ရမလဲ။",
    "answer": "ကိုယ်ဘယ်နှစ်ဘာသာ ယူရဦးမလဲဆိုတာကို Student Portal ထဲက Degree Audit Report ထဲမှာရော My Courses ထဲမှာပါ အသေးစိတ် စစ်ဆေးနိုင်ပါတယ်။ ဘာသာရပ် ရွေးချယ်တဲ့အခါ ကျောင်းဘက်က သတ်မှတ်ထားတဲ့ Learning Pathway အတိုင်း တစ်ပြိုင်တည်း မယူစေချင်တဲ့ ဘာသာရပ်တွေကို ခွဲခြားပြီး အလှည့်ကျ စာရင်းဖွင့်ပေးတာ ဖြစ်ပါတယ်။ အကယ်၍ ကိုယ်က Sequence 1 မှာ ပေါ်နေတဲ့ ဘာသာရပ်ကို အခုလောလောဆယ် မယူချင်သေးဘဲ ကျော်ချင်တယ်ဆိုရင် အဲ့ဒီဘာသာရပ် လူပြည့် (Full ဖြစ်) သွားတဲ့အထိ စောင့်ကြည့်ရပါမယ်။ Portal ထဲ မကြာခဏ ဝင်ကြည့်ပြီး အဲ့ဒီ ဘာသာရပ် နေရာပြည့်သွားပြီဆိုမှ နောက်ထပ် ယူချင်တဲ့ တခြားဘာသာရပ်ကို စနစ်က အလိုအလျောက် ဖွင့်ပေးမှာ ဖြစ်ပါတယ်။ တတိယမြောက် Term ကစပြီး ကိုယ့်ရဲ့ CGPA က ၃ ဒသမ ၀ အထက် ရှိနေမယ်ဆိုရင် တစ် Term ကို ၄ ဘာသာအထိ တိုးယူခွင့် ရရှိလာမှာ ဖြစ်ပါတယ်။"
  },
  {
    "id": 20,
    "question": "အတန်းမစတင်မီ သင်ရိုးညွှန်းတမ်း ကြိုတင်ကြည့်ရှုနိုင်တဲ့ Online Syllabus Repository (OSR) ဆိုတာ ဘာလဲ၊ ဘယ်လို ဝင်ရောက်ရမလဲ။",
    "answer": "အတန်းမစတင်မီ ဘာသာရပ်တစ်ခုချင်းစီမှာ ဘာတွေ သင်ကြားမလဲ၊ ဖတ်ရှုရမယ့် ပြဋ္ဌာန်းစာအုပ်တွေ၊ သင်ရိုးအချိန်ဇယားတွေနဲ့ အမှတ်ပေးစည်းမျဉ်းတွေ ဘာတွေရှိလဲဆိုတာကို Online Campus ထဲက Syllabus Repository (OSR) ဆိုတဲ့ နေရာမှာ ကြိုတင် ဝင်ရောက် လေ့လာနိုင်ပါတယ်။ ဒီစနစ်ထဲမှာ Term အသစ်တွေအတွက် ထည့်သွင်းထားတဲ့ ဘာသာရပ်အသစ်တွေရဲ့ Unit တစ်ခုချင်းစီ အသေးစိတ် အချက်အလက်တွေကိုပါ အပြည့်အစုံ ဖော်ပြပေးထားတာကြောင့် အတန်းမတက်ခင် ကြိုတင် ပြင်ဆင်ထားနိုင်ဖို့ အထူး အထောက်အကူပြုပါတယ်။"
  },
  {
    "id": 21,
    "question": "ကျောင်းစမတက်ခင် Orientation က ဘာကြောင့် အရေးကြီးပြီး APA Style ကို ဘယ်လို ကြိုတင် ပြင်ဆင်ထားသင့်သလဲ။",
    "answer": "ကျောင်းမစခင်မှာ ၄ နာရီခန့် အချိန်ယူရတဲ့ အွန်လိုင်း Orientation ကို မဖြစ်မနေ အရင် ပြီးအောင် လုပ်ဆောင်ရပါတယ်။ ဒီ Orientation ကနေတစ်ဆင့် ကျောင်းရဲ့ စာသင်ကြားရေး ပုံစံတွေကို အပြည့်အစုံ နားလည်သွားစေပါတယ်။ ဒါ့အပြင် apastyle.apa.org ဆိုတဲ့ ဝဘ်ဆိုက်မှာ ဝင်ရောက်ပြီး UoPeople က အဓိက သတ်မှတ်ထားတဲ့ APA 7th Edition ပုံစံကို ကြိုတင် လေ့လာထားသင့်ပါတယ်။ စာရေးတဲ့အခါ စာပိုဒ်တွေအတွင်း In-text citation ဘယ်လို ထည့်ရမလဲဆိုတာနဲ့ စာရင်းအောက်ဆုံးမှာ References စာရင်းကို APA Style အတိုင်း ဘယ်လို စနစ်တကျ ရေးဖွဲ့ရမလဲဆိုတာတွေကို ကြိုတင် နားလည်ထားဖို့ အလွန် အရေးကြီးပါတယ်။"
  },
  {
    "id": 22,
    "question": "အပတ်စဉ် Assignment တွေနဲ့ Peer Assessment စနစ်ကို ဘယ်လို နည်းစနစ်တကျ ဖြတ်သန်းရမလဲ။",
    "answer": "UoPeople ဟာ ဆရာဆီက အကုန်သင်ယူတာထက် ကိုယ်တိုင်လေ့လာရတဲ့ Self-learning စနစ် ဖြစ်ပါတယ်။ အပတ်စဉ် Learning Guide ထဲက ဖတ်စာတွေကို ဖတ်ပြီး Discussion Forum မေးခွန်းကို ကိုယ်ပိုင်အတွေ့အကြုံနဲ့ ချိတ်ဆက်ကာ စနစ်တကျ ပြန်လည်ဖြေဆိုရပါတယ်။ Initial Post ကို တနင်္ဂနွေနေ့ ညနောက်ဆုံးထားပြီး စောစော တင်ပေးတာ ပိုကောင်းပါတယ်။ ကိုယ်တိုင် စာတင်ရုံသာမက တခြားကျောင်းသား ၂ ယောက် ဒါမှမဟုတ် ၃ ယောက်ရဲ့ စာတွေကို ဝင်ရောက်စစ်ဆေး အမှတ်ပေးတဲ့ Peer Assessment ကိုလည်း Due Date မတိုင်ခင် စနစ်တကျ လုပ်ပေးရပါမယ်။ လူစုပြုံနေတဲ့ ပို့စ်တွေထက် Assessment မရသေးတဲ့ သူတွေကို ဦးစားပေး အမှတ်ပေးတာက ပိုမို အားသာချက် ရှိပါတယ်။"
  },
  {
    "id": 23,
    "question": "Assignment တွေမှာ ထည့်ရမယ့် စာကိုးကားချက် References နဲ့ In-text citations တွေကို အလွယ်တကူ ဘယ်လို ထုတ်ယူနိုင်မလဲ။",
    "answer": "Citation Machine လို့ခေါ်တဲ့ ဝဘ်ဆိုက်ကို အသုံးပြုပြီး အလွယ်တကူ ပြုလုပ်နိုင်ပါတယ်။ ကိုယ်ကိုးကားချင်တဲ့ ဝဘ်ဆိုက်လင့်ခ်ကို ကူးယူပြီး အဲ့ဒီထဲ ထည့်လိုက်တာနဲ့ APA 7th Format အတိုင်း Reference စာကြောင်း ထွက်လာမှာ ဖြစ်ပါတယ်။ အဲ့ဒီရလဒ်မှာပါတဲ့ In-text citation ဆိုတာကို နှိပ်လိုက်ရင် စာရေးသူနာမည်နဲ့ ခုနှစ်ပါ တစ်ခါတည်း ပေါ်လာပါလိမ့်မယ်။ သတိထားရမှာက ကိုယ်ယူတဲ့ ဝဘ်ဆိုက်ရင်းမြစ်ထဲမှာ ရေးသားသူ Author နာမည်နဲ့ ထုတ်ဝေတဲ့ Publication Year သေချာ ပါမပါကို အမြဲ စစ်ဆေးရွေးချယ်ရပါမယ်။"
  },
  {
    "id": 24,
    "question": "Written Assignment တွေနဲ့ Assignment Activity တွေကို ဘယ်လို Format အတိုင်း ရေးသားပြီး အမှတ်ပေးစနစ်က ဘယ်လို ရှိပါသလဲ။",
    "answer": "Microsoft Word ကို ဖွင့်ပြီး Times New Roman ဖောင့်၊ Font size 12၊ Line spacing 2.0 နဲ့ ဘယ်ဘက်စာလုံးညှိပြီး ရေးသားရပါတယ်။ ပထမတစ်မျက်နှာလုံးကို Title Page အနေနဲ့ ယူရပြီး ဒုတိယမျက်နှာရောက်မှသာ မေးခွန်းရဲ့ အဖြေတွေကို စတင် ဖြေဆိုရပါတယ်။ စာရေးပြီးတဲ့အခါ စာပိုဒ်အောက်ဆုံးမှာ စာလုံးရေ Word Count ကို ထည့်သွင်းပေးရပြီး References အတွက် နောက်ထပ် မျက်နှာအသစ်တစ်ခု ယူပြီးမှ ရေးသားရပါမယ်။ Written Assignment ပါတဲ့ ဘာသာရပ်တွေမှာ ဒုတိယပတ်မှာ ကိုယ်တိုင် စာတင်ရပြီး တတိယပတ်ရောက်မှ တခြားကျောင်းသား ၃ ယောက်ရဲ့ စာတွေကို အမှတ်ပေးရပါတယ်။ ကျောင်းသားအချင်းချင်း ပေးတဲ့အမှတ် နည်းလွန်းနေရင် ဆရာဆီ အကြောင်းပြချက်နဲ့တကွ အမှတ်ပြန်စစ်ဆေးပေးဖို့ တောင်းဆိုနိုင်ပါတယ်။ Assignment Activity ကတော့ အပတ်စဉ် သတ်မှတ်ရက်အတိုင်း ဆရာဆီ တိုက်ရိုက် တင်ရတာဖြစ်ပြီး ဆရာ့ရဲ့ Rubric စံနှုန်းတွေကို ကြည့်ပြီး သေချာ ဖြေဆိုရပါတယ်။"
  },
  {
    "id": 25,
    "question": "စာမေးပွဲတွေနဲ့ Quizzes စနစ်က ဘယ်လို အလုပ်လုပ်သလဲ။",
    "answer": "အပတ်စဉ်တိုင်းမှာ အမှတ်မပေးတဲ့ Self-quiz တွေ ပါဝင်ပြီး ဒါတွေကို အကြိမ်ကြိမ် ပြန်ဖြေလေ့ကျင့်ထားနိုင်ပါတယ်။ တတိယပတ်နဲ့ ဆဋ္ဌမပတ်တွေမှာတော့ အမှတ်စာရင်းထဲ တကယ်ပေါင်းထည့်မယ့် Graded Quiz တွေကို ဖြေဆိုရပါတယ်။ Self-quiz ကို ပိုင်နိုင်အောင် ဖြေထားရင် Graded Quiz မှာ အမှတ်ပြည့် ရနိုင်ပါတယ်။ အပတ်စဉ် ၈ မှာ Final စာမေးပွဲအတွက် ပြန်လည်လေ့ကျင့်ဖို့ Review Quiz ဖွင့်ပေးပါတယ်။ နောက်ဆုံး ၉ ပတ်မြောက်မှာတော့ Final Exam ကို ကြာသပတေးနေ့ကနေ တနင်္ဂနွေနေ့အထိ (မြန်မာစံတော်ချိန် ကြာသပတေး မနက် ၁၁ နာရီခွဲမှ တနင်္လာ မနက် ၁၁ နာရီခွဲအထိ) ၄ ရက်တာ ကာလအတွင်း ဖြေဆိုရတာ ဖြစ်ပါတယ်။ မထင်မှတ်ထားတဲ့ နည်းပညာ ချို့ယွင်းချက်တွေ ကြုံရရင် သက်သေ Screenshot ရိုက်ပြီး ဆက်သွယ်နိုင်အောင် စောစော ဖြေဆိုထားသင့်ပါတယ်။"
  },
  {
    "id": 26,
    "question": "မေဂျာအလိုက် မဖြစ်မနေ ဖြေဆိုရမယ့် Rosalyn Proctor ဘာသာရပ် ၁၁ ခုက ဘာတွေလဲ။",
    "answer": "General Education အနေနဲ့ မေဂျာအားလုံး မဖြစ်မနေ ယူရတာက HIST 1421 Greek and Roman Civilization ဖြစ်ပါတယ်။ Business မေဂျာအတွက်ဆိုရင် MATH 1201 College Algebra၊ MATH 1280 Introduction to Statistics၊ BUS 2201 Principles of Marketing၊ BUS 2202 E-Commerce၊ BUS 3303 Entrepreneurship 1၊ BUS 3305 Business Law and Ethics၊ BUS 3306 Business and Society၊ BUS 4402 Organizational Behavior၊ BUS 4403 Business Policy and Strategy နဲ့ BUS 4405 Leadership တို့ ဖြစ်ပါတယ်။\nHealth Science မေဂျာအတွက်ဆိုရင် သင်္ချာနှစ်ခုအပြင် HS 2211 Human Anatomy and Physiology၊ HS 2711 Health Education and Behavior၊ HS 3311 Epidemiology၊ HS 3610 Human Development in a Global Perspective၊ HS 4212 Genetics၊ HS 4241 Psychopathology and Mental Health၊ HS 4510 Biostatistics နဲ့ HS 4810 Health Policy & Management တို့ ပါဝင်ပါတယ်။\nComputer Science မေဂျာအတွက်ဆိုရင်တော့ သင်္ချာနှစ်ခုအပြင် CS 2205 Web Programming 1၊ CS 2301 Operating Systems 1၊ CS 3305 Web Programming 2၊ CS 3306 Databases 2၊ CS 3303 Data Structures၊ CS 3307 Operating Systems 2၊ CS 4407 Data Mining and Machine Learning နဲ့ CS 4402 Comparative Programming Languages တို့ ဖြစ်ပါတယ်။"
  },
  {
    "id": 27,
    "question": "အသစ်ပြောင်းလဲလိုက်တဲ့ Rosalyn AI စာမေးပွဲစောင့်ကြည့်ရေး စနစ်အကြောင်းနဲ့ စာမေးပွဲခန်းတွင်း လိုက်နာရမယ့် စည်းကမ်းတွေကို ရှင်းပြပေးပါ။",
    "answer": "အရင်က သုံးခဲ့တဲ့ အခပေး ProctorU စနစ်နဲ့ လူကိုယ်တိုင် စောင့်ကြည့်တဲ့ Offline စနစ်တွေအစား Rosalyn AI စနစ်ကို အသုံးပြုနေပြီ ဖြစ်ပါတယ်။ အနည်းဆုံး RAM 2GB နဲ့ Free space 500MB ရှိတဲ့ Windows ဒါမှမဟုတ် Mac ကွန်ပျူတာ၊ ကင်မရာ၊ မိုက်နဲ့ Stable Internet လိုအပ်ပြီး ဖုန်း ဒါမှမဟုတ် Tablet တွေနဲ့ ဖြေဆိုခွင့် လုံးဝ မရှိပါဘူး။ မေးခွန်းဖြေဆိုနေစဉ်အတွင်း မော်နီတာအပို တပ်ဆင်သုံးစွဲခွင့် မရှိသလို အသံထွက်ပြီး စာရွတ်တာ၊ တီးတိုးပြောဆိုတာနဲ့ အခန်းထဲ တခြားသူ ဝင်ရောက် စကားပြောတာတွေကို AI က အသံဖမ်းယူပြီး စည်းကမ်းဖောက်ဖျက်မှုအဖြစ် သတ်မှတ်ပါတယ်။ စာမေးပွဲမစတင်မီ နိုင်ငံသားစိစစ်ရေးကတ် ဒါမှမဟုတ် နိုင်ငံကူးလက်မှတ်ကို ကင်မရာရှေ့မှာ ပြသပြီး လူမှန်ကန်ကြောင်း အတည်ပြုရပါတယ်။ သင်္ချာဘာသာရပ်တွေမှာ စာကြမ်းတွက်ဖို့ စာရွက်အလွတ်နဲ့ Scientific Calculator သုံးခွင့်ပြုတတ်ပေမယ့် အဲ့ဒီစာရွက်ကို ကင်မရာရှေ့မှာ အရှေ့အနောက် သေချာ ပြသရလေ့ရှိပါတယ်။"
  },
  {
    "id": 28,
    "question": "စာမေးပွဲဖြေဆိုပြီးရင် အမှတ်စာရင်းကို ဘယ်နေရာမှာ ကြိုတင် စစ်ဆေးနိုင်ပြီး Grades Published By ဆိုတာ ဘာလဲ။",
    "answer": "Final Exam ဖြေဆိုပြီးသွားတာနဲ့ တရားဝင် အမှတ်စာရင်း မထုတ်ပြန်မီ စာမေးပွဲ အမှတ်ကို Online Campus ထဲက Profile သို့သွားပြီး Grades ထဲက သက်ဆိုင်ရာ Course အောက်မှာ ကြိုတင် ဝင်ရောက် စစ်ဆေးနိုင်ပါတယ်။ ဒါ့အပြင် Student Portal ထဲမှာလည်း ဝင်ရောက် ကြည့်ရှုနိုင်ပါတယ်။ Grades Published By ဆိုတာကတော့ ကျောင်းဘက်ကနေ သက်ဆိုင်ရာ Term တစ်ခုလုံးရဲ့ အမှတ်စာရင်းတွေကို တရားဝင် အတည်ပြု ထုတ်ပြန်ပေးပြီး အောင်မြင်ခဲ့တဲ့ ဘာသာရပ်တွေရဲ့ Credits တွေကို မိမိရဲ့ စုစုပေါင်း ဘွဲ့မှတ်တမ်းထဲ ထည့်သွင်း ပေါင်းစပ်ပေးတဲ့ သတ်မှတ်ရက်စွဲ ဖြစ်ပါတယ်။"
  },
  {
    "id": 29,
    "question": "UoPeople မှာ အမှတ်ပေး ရာခိုင်နှုန်းနဲ့ သက်ဆိုင်ရာ Grade သတ်မှတ်ချက်တွေက ဘယ်လိုရှိပါသလဲ။",
    "answer": "ရာခိုင်နှုန်း ၉၃ မှ ၉၈ သည် A+ (၄ ဒသမ ၀)၊ ၉၃ မှ ၉၇ သည် A (၄ ဒသမ ၀)၊ ၉၀ မှ ၉၂ သည် A- (၃ ဒသမ ၆၇) ဖြစ်ပါတယ်။ ၈၇ မှ ၈၉ သည် B+ (၃ ဒသမ ၃၃)၊ ၈၃ မှ ၈၆ သည် B (၃ ဒသမ ၀)၊ ၈၀ မှ ၈၂ သည် B- (၂ ဒသမ ၆၇) အသီးသီး ဖြစ်ပါတယ်။ ၇၇ မှ ၇၉ သည် C+ (၂ ဒသမ ၃၃)၊ ၇၃ မှ ၇၆ သည် C (၂ ဒသမ ၀) နဲ့ ၇၀ မှ ၇၂ အတွင်း ရောက်ရင် C- (၁ ဒသမ ၆၇) အဖြစ် သတ်မှတ်ပါတယ်။"
  },
  {
    "id": 30,
    "question": "CGPA ဘယ်လို တွက်ချက်ထားပြီး အနိမ့်ဆုံးနဲ့ အမြင့်ဆုံး ရနိုင်ခြေတွေက ဘယ်လိုရှိပါသလဲ။",
    "answer": "၅ ဘာသာ ယူထားတဲ့ ဥပမာနဲ့ တွက်ချက်ကြည့်နိုင်ပါတယ်။ အကယ်၍ ဘာသာရပ်တစ်ခုမှာ ၇၀ မှတ်ရပြီး C- (၁ ဒသမ ၆၇) ဖြစ်သွားကာ ကျန် ၄ ဘာသာမှာ ၉၀ မှတ်စီနဲ့ A- (၃ ဒသမ ၆၇) စီ ရခဲ့မယ်ဆိုရင် အမှတ်အားလုံးပေါင်း ၁၆ ဒသမ ၃၅ ကို ၅ ဘာသာနဲ့ စားတဲ့အခါ ပျမ်းမျှ CGPA ၃ ဒသမ ၂၇ ရရှိမှာ ဖြစ်ပါတယ်။ သို့သော်လည်း ကျောင်းစည်းကမ်းအရ ဘာသာရပ်တစ်ခုချင်းစီမှာ အနည်းဆုံး ၇၃ မှတ်အထက် C Grade (၂ ဒသမ ၀) ရအောင် အမြဲ ထိန်းထားရပါမယ်။ အမြင့်ဆုံး ရနိုင်ခြေ တွက်ချက်မှုမှာတော့ ဘာသာရပ်တစ်ခုမှာ ၇၃ မှတ်ကျော် C (၂ ဒသမ ၀) ရပြီး ကျန် ၄ ဘာသာလုံး ၉၃ မှတ်ကျော် A (၄ ဒသမ ၀) စီ ရခဲ့မယ်ဆိုရင် စုစုပေါင်း အမှတ် ၁၈ ကို ၅ ဘာသာနဲ့ စားလိုက်တဲ့အခါ ပျမ်းမျှ CGPA အမြင့်ဆုံး ၃ ဒသမ ၆၀ အထိ ရရှိနိုင်ပါတယ်။"
  },
  {
    "id": 31,
    "question": "CGPA အကောင်းဆုံးရအောင် Assignment တွေ၊ Quiz တွေနဲ့ စာမေးပွဲတွေကို ဘယ်လို နည်းစနစ်တကျ ပြင်ဆင်ရမလဲ။",
    "answer": "CGPA ကောင်းကောင်း ရရှိဖို့အတွက် Assignment ရေးတဲ့အခါ မေးခွန်းက တောင်းဆိုထားတဲ့ အချက်အလက်အတိုင်း တိတိကျကျ ဝင်အောင် ရေးသားရပါမယ်။ AI နဲ့ အလုံးစုံ ဖန်တီးရေးသားတာမျိုး လုံးဝ မလုပ်သင့်သလို APA Format အတိုင်း စာကိုးကားချက်တွေ တိကျမှန်ကန်နေရပါမယ်။ Graded Quiz တွေမှာ အမှတ်မလျော့စေဖို့အတွက် သက်ဆိုင်ရာ အပတ်စဉ်တွေမှာ ပေးထားတဲ့ Self-quiz တွေကို အကြိမ်ကြိမ် အထပ်ထပ် ပြန်လည်ဖြေဆို လေ့ကျင့်ထားရပါမယ်။ Final Exam အတွက်ဆိုရင်တော့ အပတ်စဉ် ၈ မှာ ဖွင့်ပေးတဲ့ Review Quiz တွေကို များများ လေ့ကျင့်ထားရင် စာမေးပွဲကို အခက်အခဲမရှိ ဖြေဆိုနိုင်မှာ ဖြစ်ပါတယ်။"
  },
  {
    "id": 32,
    "question": "Honor List နဲ့ Latin Honors အဆင့်တွေထဲ ပါဝင်ဖို့ ကျောင်းက ဘယ်လို စည်းမျဉ်းတွေ သတ်မှတ်ထားသလဲ။",
    "answer": "Term တစ်ခုအတွင်းမှာ အနည်းဆုံး ၃ ခရက်ဒစ်ရှိတဲ့ ဘာသာရပ်တစ်ခု အောင်မြင်ထားရမှာဖြစ်ပြီး ဘယ်ဘာသာရပ်မှာမှ C Grade အောက် (၂ ဒသမ ၀ အောက်) မကျဆင်းရပါဘူး။ Plagiarism ကင်းရှင်းတဲ့ ကျောင်းသားတွေအတွက် Term အလိုက် CGPA ၃ ဒသမ ၀ မှ ၃ ဒသမ ၄၉ ဆိုရင် Honor's List၊ ၃ ဒသမ ၅၀ မှ ၃ ဒသမ ၈၄ ဆိုရင် Dean's List နဲ့ ၃ ဒသမ ၈၅ ကနေ ၄ ဒသမ ၀ အထိ ရရင်တော့ President's List စာရင်းဝင် ဖြစ်လာပါတယ်။ ဘွဲ့ရတဲ့အခါမှာလည်း စုစုပေါင်း CGPA အပေါ် မူတည်ပြီး Summa Cum Laude (CGPA 3.85 – 4.00)၊ Magna Cum Laude (CGPA 3.70 – 3.84) နဲ့ Cum Laude (CGPA 3.50 – 3.69) စတဲ့ လက်တင်ဂုဏ်ထူးဆောင်ဘွဲ့တွေ ပေးအပ်ပါတယ်။"
  },
  {
    "id": 33,
    "question": "ပုံမှန်အတိုင်း ဘာသာရပ်တွေ အပြည့်ယူသွားရင် ဘွဲ့ရဖို့ ဘယ်လောက်ကြာမြင့်နိုင်သလဲ။",
    "answer": "ပထမနှစ် Term 1 နဲ့ Term 2 မှာ ၂ ဘာသာစီနဲ့ ၄ ဘာသာ ပြီးမြောက်နိုင်ပါတယ်။ Term 3 ကနေ Term 5 အထိ ၄ ဘာသာစီ ယူနိုင်ခဲ့ရင် ၁၂ ဘာသာ ထပ်တိုးပြီး ပထမနှစ်မှာ စုစုပေါင်း ၁၆ ဘာသာ ပြီးမြောက်ပါမယ်။ ဒုတိယနှစ် Term 6 ကနေ Term 10 အထိ ၄ ဘာသာစီ ဆက်ယူရင် နောက်ထပ် ဘာသာရပ် ၂၀ ပြီးမြောက်တာမို့ ၂ နှစ်အတွင်းမှာ ၃၆ ဘာသာ ပြီးစီးသွားပါလိမ့်မယ်။ ကျန်ရှိတဲ့ ၄ ဘာသာကို Term 11 မှာ အပြီးယူလိုက်ရင် ဘာသာရပ် ၄၀ ဒါမှမဟုတ် Credit ၁၂၀ ပြည့်ပြီး Bachelor ဘွဲ့ ရရှိနိုင်ပါတယ်။ ဒါပေမဲ့ Health Science မေဂျာမှာတော့ ဘာသာရပ် ၄၁ ခုနဲ့ Credit ၁၂၂ အထိ ရှိပြီး နောက်ဆုံး Capstone ဘာသာရပ်နှစ်ခုကို တစ်ပြိုင်တည်း ယူခွင့်မပြုတာကြောင့် ၂ နှစ်နဲ့ နောက်ထပ် ၂ Term ခန့် ပိုမို ကြာမြင့်နိုင်ပါတယ်။"
  },
  {
    "id": 34,
    "question": "Sophia Learning မှ Credit Transfer ပြုလုပ်တဲ့ စနစ်ဆိုတာ ဘာလဲ။",
    "answer": "Sophia Learning ဆိုတာ အမေရိကန် ACE ရဲ့ အသိအမှတ်ပြုမှု ရထားတဲ့ အွန်လိုင်း ပလက်ဖောင်းတစ်ခု ဖြစ်ပြီး အဲ့ဒီက ရတဲ့ Credits တွေကို UoPeople ဘွဲ့အတွက် ထည့်သွင်း လွှဲပြောင်းနိုင်ပါတယ်။ အထူးသဖြင့် မေဂျာနဲ့ တိုက်ရိုက် မပတ်သက်တဲ့ General Education နဲ့ Electives ဘာသာရပ်တွေကို Sophia ကနေ ယူပြီး ရက်ပိုင်းအတွင်း ဖြေဆိုလိုက်တာက အချိန်ရော ငွေရော အများကြီး သက်သာစေပါတယ်။ Sophia ကနေ UoPeople ဆီ ဘာသာရပ် ၂၀ အထိ Transfer Fee ပေးစရာမလိုဘဲ အခမဲ့ လွှဲပြောင်းခွင့် ရရှိပါတယ်။"
  },
  {
    "id": 35,
    "question": "Sophia Learning မှာ Milestones နဲ့ Touchstones ဆိုတာ ဘာကွာခြားပြီး ဘယ်လို အချိန် စီမံခန့်ခွဲ သင့်သလဲ။",
    "answer": "Milestones ဆိုတာ ရွေးချယ်စရာ Quiz မေးခွန်းတွေကိုသာ ဖြေဆိုသွားရတာဖြစ်ပြီး လေ့လာမှုအပေါ် မူတည်ကာ နာရီပိုင်းအတွင်း အမြန် ပြီးမြောက်နိုင်ပါတယ်။ Touchstones ကတော့ သီးသန့် Assignment ဒါမှမဟုတ် Essay စာတမ်း ရေးသား တင်သွင်းရတာဖြစ်ပြီး ဆရာတွေဘက်က ပြန်လည်စစ်ဆေး အမှတ်ပေးဖို့ ၂ ရက်ကနေ ၃ ရက်အထိ အချိန်ယူတတ်ပါတယ်။ Sophia မှာ တစ်ပြိုင်တည်း ဘာသာရပ် ၂ ခုသာ ယူခွင့်ရှိတာမို့ ဘာသာရပ်တစ်ခုကို Milestones သီးသန့်ယူပြီး နောက်တစ်ခုကို Touchstones ပါတာ ယူထားသင့်ပါတယ်။ Touchstone စစ်ဆေးနေတဲ့ ကာလအတွင်း အခြား Milestones တွေကို တစ်ခုပြီးတစ်ခု အမြန် ဖြေဆိုသွားတာက တစ်လအတွင်း ဘာသာရပ် အများဆုံး ပြီးမြောက်စေမယ့် နည်းလမ်းကောင်း ဖြစ်ပါတယ်။"
  },
  {
    "id": 36,
    "question": "Sophia Learning အသုံးပြုရာမှာ အကောင့် အပိတ်မခံရအောင် ဘာတွေ အထူးသတိထားရမလဲ။",
    "answer": "နောက်ပိုင်းမှာ စည်းကမ်းတွေ အရမ်းတင်းကျပ်လာတာကြောင့် Device နှစ်ခုပြိုင်ပြီး သုံးတာ၊ Browser ထဲမှာ Tab အသစ်တွေဖွင့်ပြီး AI နဲ့ ရှာဖြေတာ၊ VPN သုံးတာမျိုးတွေ လုံးဝ မလုပ်သင့်ပါဘူး။ ဘာသာရပ်တစ်ခုကို နာရီပိုင်းအတွင်း အတင်းအဓမ္မ အမြန်ပြီးအောင် လုပ်တာမျိုး မလုပ်ဘဲ အနည်းဆုံး ၁၀ နာရီကနေ တစ်ရက်လောက်အထိ အချိန်ယူပြီး စာဖတ်လေ့လာတာ ပိုဘေးကင်းပါတယ်။ တကယ်လို့ အကောင့် ယာယီ ပိတ်ခံရရင်လည်း အငြင်းမပွားဘဲ အကြောင်းပြချက်ကို ရိုးရိုးသားသား အီးမေးလ်ကနေ အယူခံတင်ပြကာ လိုအပ်ရင် အင်တာဗျူး ဖြေဆိုပြီး ဖြေရှင်းရပါမယ်။"
  },
  {
    "id": 37,
    "question": "Sophia က ပြီးသွားတဲ့ ဘာသာရပ်တွေကို Credly ကနေ UoPeople Portal ဆီ အဆင့်ဆင့် ဘယ်လို Transfer လုပ်ရမလဲ။",
    "answer": "Sophia အကောင့်ဖွင့်ထားတဲ့ အီးမေးလ်အတိုင်း Credly အကောင့်ကို ဖွင့်ရပါမယ်။ ဘာသာရပ်တွေ ပြီးသွားတဲ့အခါ Credly ထဲဝင်ပြီး Send Transcript ကို နှိပ်ကာ Institution နေရာမှာ University of the People ကို ရွေးပြီး Recipient Email နေရာမှာ transfer.credit@uopeople.edu ကို ဖြည့်စွက်ကာ Official Transcript PDF ဖိုင်ကို ဒေါင်းလုဒ် ရယူရပါမယ်။ အဲ့ဒီနောက် UoPeople Student Portal ထဲက Admissions ကနေ Transfer Credits ကို ရွေးပြီး New Request ပြုလုပ်ရပါတယ်။ နိုင်ငံနေရာမှာ USA၊ ပြည်နယ်နေရာမှာ Minnesota၊ ကျောင်းနေရာမှာ Sophia Learning နဲ့ Program မှာ ကိုယ်တက်နေတဲ့ ဒီဂရီကို ရွေးချယ်ကာ ဒေါင်းလုဒ်ဆွဲထားတဲ့ Transcript ဖိုင်ကို Upload တင်ပေးရပါမယ်။ လျှောက်ထားပြီးတာနဲ့ Program Advisor ဆီ အီးမေးလ်ပို့ပြီး အမြန် စစ်ဆေးပေးဖို့ အသိပေးရပါတယ်။ အကယ်၍ Pending Payment ပေါ်လာရင်လည်း Request ထဲ ပြန်ဝင်ပြီး Save & Continue လုပ်ကာ သက်ဆိုင်ရာ ဘာသာရပ်တွေကို ရွေးချယ်ပြီး အတည်ပြုပေးရပါတယ်။"
  },
  {
    "id": 38,
    "question": "Sophia မဟုတ်ဘဲ မြန်မာပြည်က တက္ကသိုလ်တွေ ဒါမှမဟုတ် UK က ရထားတဲ့ Transcript တွေနဲ့ UoPeople ဆီ Credit Transfer လုပ်ချင်ရင် ဘယ်လို အဆင့်ဆင့် လုပ်ဆောင်ရမလဲ။",
    "answer": "အမေရိကန် အခြေစိုက် မဟုတ်တဲ့ တခြားနိုင်ငံတွေက ရထားတဲ့ စာရွက်စာတမ်းတွေနဲ့ Transfer လုပ်မယ်ဆိုရင် US ပညာရေးစနစ်နဲ့ ကိုက်ညီမှု ရှိမရှိကို အကဲဖြတ်စစ်ဆေးပေးတဲ့ AICE ဒါမှမဟုတ် NACES အဖွဲ့ဝင် အဖွဲ့အစည်းတွေဆီ အရင်ဆုံး အပ်နှံရပါတယ်။ ဒီလို ဝန်ဆောင်မှုပေးတဲ့နေရာမှာ WES (World Education Services) က အသုံးအများဆုံးနဲ့ လူသိအများဆုံး ဖြစ်ပြီး တခြားကျောင်းတွေ ပြောင်းတဲ့အခါမှာလည်း သုံးလို့ရပါတယ်။ ဒါပေမဲ့ WES လို အဖွဲ့အစည်းမျိုးမှာ စစ်ဆေးခ Evaluation Fee က ဒေါ်လာ ၂၀၀ ဝန်းကျင်အထိ ကုန်ကျနိုင်တာမို့ အနည်းငယ် ဈေးကြီးတတ်ပါတယ်။ Evaluation စာရွက်စာတမ်း ထွက်လာပြီးမှ UoPeople ဆီ Credit Transfer လျှောက်တဲ့အခါ ကျောင်းဘက်ကို တစ်ဘာသာလျှင် Transfer ကြေး ၁၇ ဒေါ်လာစီ (ဘာသာရပ် ၁၀ ခုဆိုရင် ၁၇၀ ဒေါ်လာ) ထပ်မံ ပေးသွင်းရပါတယ်။ မိမိဆန္ဒအရ ဘာမှ Transfer မလုပ်ဘဲ UoPeople မှာ အစအဆုံး တက်ရောက်နိုင်သလို Sophia ဒါမှမဟုတ် Saylor စတာတွေကနေတစ်ဆင့် Transfer လုပ်ပြီးလည်း တက်ရောက်နိုင်ပါတယ်။"
  },
  {
    "id": 39,
    "question": "ကျောင်းပြီးဆုံးလို့ Graduation Request Form တင်တဲ့အခါ Regular နဲ့ Express ဘာကွာခြားပြီး ဘယ်လောက် ကြာမြင့်နိုင်သလဲ။",
    "answer": "Regular နည်းလမ်းက အချိန်အရမ်း ကြာမြင့်နိုင်သလို မြန်မာနိုင်ငံဆီ စာရွက်စာတမ်း မူရင်း တိုက်ရိုက် ပို့ဆောင်ပေးခြင်း မရှိပါဘူး။ မြန်မာနိုင်ငံဆီ အရောက် ပို့ဆောင်စေချင်ရင်တော့ ၁၂၀ ဒေါ်လာ ပေးသွင်းရတဲ့ Express Delivery နည်းလမ်းကို ရွေးချယ်ရပါမယ်။ သတ်မှတ်ထားတဲ့ Term ရဲ့ ၄ ပတ်မြောက်အတွင်း အချိန်မီ လျှောက်ထားနိုင်ရင် အဲ့ဒီ Term ပြီးဆုံးတာနဲ့ စာရွက်စာတမ်းတွေကို DHL နဲ့ ပို့ဆောင်ပေးဖို့ ပြင်ဆင်ပေးလေ့ရှိပါတယ်။ ဒါပေမဲ့ ၅ ပတ်မြောက်မှ နောက်ကျပြီး လျှောက်မိရင်တော့ နောက်ထပ် Term အသစ် စတင်တဲ့အထိ စောင့်ဆိုင်းရပြီး အချိန် ၂ လကျော်အထိ ကြာမြင့်သွားနိုင်ပါတယ်။"
  },
  {
    "id": 40,
    "question": "စာသင်ကြားရေးနဲ့ ဘွဲ့ယူတဲ့ အဆင့်တွေမှာ အထူးသတိပြုရမယ့် ပညာရေးဆိုင်ရာ စည်းကမ်းချက်တွေက ဘာတွေလဲ။",
    "answer": "စာရေးတဲ့အခါ AI ကို သတင်းအချက်အလက် စုဆောင်းတာလောက်ပဲ သုံးသင့်ပြီး အလုံးစုံ ကူးချတာ ဒါမှမဟုတ် တခြားသူတွေနဲ့ ပုံစံတူ ရေးသားတာမျိုး လုံးဝ မလုပ်သင့်ပါဘူး။ အထူးသဖြင့် Health Science မေဂျာ တက်ရောက်နေသူတွေအနေနဲ့ AI က မရှိတဲ့ ရင်းမြစ်တွေကိုပါ ဖန်တီးပြတတ်တာကြောင့် အထူး သတိပြုရပါမယ်။ Plagiarism စည်းကမ်း ချိုးဖောက်မိရင် အမှတ် သုည ရရှိသွားနိုင်သလို Academic Dishonesty အဖြစ် မှတ်တမ်းတင်ခံရပါက နောင်တစ်ချိန် အလုပ်အကိုင်နဲ့ စကောလားရှစ် လျှောက်ထားမှုတွေမှာ ကြီးမားတဲ့ အတားအဆီး ဖြစ်စေနိုင်ပါတယ်။ စာရေးသားရာမှာ အမြဲတမ်း Academic Format (APA 7th) အတိုင်း ကိုယ်ပိုင်ဟန်နဲ့ စနစ်တကျ ရေးသားဖို့ အထူး လိုအပ်ပါတယ်။"
  }
];

export interface QuickGuideFAQProps {
  images?: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, string>>;
  imgStep1?: string;
  imgStep2?: string;
  imgStep3?: string;
  imgStep4?: string;
  imgStep5?: string;
  imgStep6?: string;
  imgStep7?: string;
}

interface LibraryStep {
  step: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  label: string;
  description: string;
  defaultImage: string;
}

const LIBRARY_GUIDE_STEPS: LibraryStep[] = [
  {
    step: 1,
    label: 'အဆင့် ၁ (ပုံ ၁):',
    description: 'UoPeople Library ကိုဝင်ရင် JSTOR ထဲကိုနှိပ်လည်းရတယ် LIRN ကိုနှိပ်လည်းရပါတယ်။',
    defaultImage: '/assets/aistudio/image_4d4c0b0f.png',
  },
  {
    step: 2,
    label: 'အဆင့် ၂ (ပုံ ၂):',
    description:
      'JSTOR ထဲကိုနှိပ်ရင် "Access provided by University of the People" ပေါ်လာပါမယ်။ search ထဲမှာ ကိုယ့်ဘာသာရပ်နဲ့သက်ဆိုင်တဲ့ဟာကို ရှာနိုင်ပါတယ်။',
    defaultImage: '/assets/aistudio/image_7429e834.png',
  },
  {
    step: 3,
    label: 'အဆင့် ၃ (ပုံ ၃):',
    description:
      'ပေါ်လာတဲ့ခေါင်းစဉ်တွေနမူနာပါ။ ကိုယ့် Assignment နဲ့ ကိုက်ညီတဲ့ စာတမ်းများကို ရွေးချယ်နိုင်ပါတယ်။',
    defaultImage: '/assets/aistudio/image_88125e16.png',
  },
  {
    step: 4,
    label: 'အဆင့် ၄ (ပုံ ၄):',
    description:
      'အပေါ်ဆုံးကလင့်ကို ဝင်လိုက်ပါတယ်။ ဒီအတိုင်းပေါ်လာပါမယ်၊ ဖတ်လို့ရပါပြီ၊ download ဆွဲလည်းရပါတယ်။',
    defaultImage: '/assets/aistudio/image_3d5beb0c.png',
  },
  {
    step: 5,
    label: 'အဆင့် ၅ (ပုံ ၅):',
    description:
      '"Cite" ကို ရွေးရင် APA ဆိုတာကို copy ကူးပြီး references မှာ ထည့်ပေးလို့ရပါတယ်။',
    defaultImage: '/assets/aistudio/image_b0a1225f.png',
  },
  {
    step: 6,
    label: 'အဆင့် ၆ (ပုံ ၆):',
    description: 'အသေးစိတ်ရှာချင်ရင် advanced search ကိုသုံးပါ။',
    defaultImage: '/assets/aistudio/image_7518c104.png',
  },
  {
    step: 7,
    label: 'အဆင့် ၇ (ပုံ ၇):',
    description:
      'LIRN မှာ ကိုယ့် assignment မှာရေးမယ့် topic အလိုက် အဲ့လင့်တွေကို အသေးစိတ်ရှာနိုင်ပါတယ်။ မေဂျာ အကုန်ရှိပါတယ်။',
    defaultImage: '/assets/aistudio/image_b0eb4fe6.png',
  },
];

interface AcademicResource {
  id: number;
  name: string;
  url: string;
  recommended?: boolean;
  badgeText?: string;
}

const RESEARCH_SEARCH_ENGINES: AcademicResource[] = [
  {
    id: 1,
    name: 'Google Scholar',
    url: 'https://scholar.google.com/',
    recommended: true,
    badgeText: '⭐ (Recommended ပါ)',
  },
  {
    id: 2,
    name: 'ScienceDirect',
    url: 'https://www.sciencedirect.com/',
  },
  {
    id: 3,
    name: 'BASE Search',
    url: 'https://www.base-search.net/',
  },
  {
    id: 4,
    name: 'CORE',
    url: 'https://core.ac.uk/',
  },
  {
    id: 5,
    name: 'Internet Archive Scholar',
    url: 'https://scholar.archive.org/',
  },
  {
    id: 6,
    name: 'JURN',
    url: 'https://www.jurn.link/#gsc.tab=0',
  },
  {
    id: 7,
    name: 'UNESCO UNESDOC',
    url: 'https://unesdoc.unesco.org/ulis/index.shtml',
  },
];

export const QuickGuideFAQ: React.FC<QuickGuideFAQProps> = ({
  images,
  imgStep1,
  imgStep2,
  imgStep3,
  imgStep4,
  imgStep5,
  imgStep6,
  imgStep7,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [openIds, setOpenIds] = useState<number[]>([]);
  const [isLibraryGuideOpen, setIsLibraryGuideOpen] = useState<boolean>(false);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const [lightboxStep, setLightboxStep] = useState<{
    step: number;
    label: string;
    description: string;
    src: string;
  } | null>(null);

  // Smart Deflection & Verification System (Helpdesk Gatekeeper) state
  const [gatekeeperQuery, setGatekeeperQuery] = useState<string>('');
  const [gatekeeperSubmitted, setGatekeeperSubmitted] = useState<boolean>(false);
  const [gatekeeperEmptyWarning, setGatekeeperEmptyWarning] = useState<boolean>(false);
  const [gatekeeperExpandedIds, setGatekeeperExpandedIds] = useState<number[]>([]);
  const [overrideAfterReading, setOverrideAfterReading] = useState<boolean>(false);
  const [isVerifiedChecked, setIsVerifiedChecked] = useState<boolean>(false);

  const propImageMap: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, string | undefined> = {
    1: imgStep1,
    2: imgStep2,
    3: imgStep3,
    4: imgStep4,
    5: imgStep5,
    6: imgStep6,
    7: imgStep7,
  };

  const resolveStepImage = (item: LibraryStep): string => {
    return images?.[item.step] || propImageMap[item.step] || item.defaultImage;
  };

  const normalizedQuery = searchTerm.trim().toLowerCase();
  const filteredFaqs = normalizedQuery
    ? FAQ_DATA.filter(
        (item) =>
          item.question.toLowerCase().includes(normalizedQuery) ||
          item.answer.toLowerCase().includes(normalizedQuery)
      )
    : FAQ_DATA;

  const toggleItem = (id: number) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const expandAll = () => {
    setOpenIds(filteredFaqs.map((item) => item.id));
  };

  const collapseAll = () => {
    setOpenIds([]);
  };

  const isAllExpanded =
    filteredFaqs.length > 0 && filteredFaqs.every((item) => openIds.includes(item.id));

  // Auto-check gatekeeper query against all 40 verbatim FAQs
  const normalizedGatekeeperQuery = gatekeeperQuery.trim().toLowerCase();
  const hasActiveGatekeeperSearch = normalizedGatekeeperQuery.length > 0;
  const gatekeeperTokens = normalizedGatekeeperQuery.split(/\s+/).filter(Boolean);

  const gatekeeperMatchedFaqs = hasActiveGatekeeperSearch
    ? FAQ_DATA.filter((item) => {
        const haystack = `${item.question} ${item.answer}`.toLowerCase();
        if (haystack.includes(normalizedGatekeeperQuery)) {
          return true;
        }
        return (
          gatekeeperTokens.length > 1 &&
          gatekeeperTokens.every((token) => haystack.includes(token))
        );
      })
    : [];

  const isGatekeeperEligibleForTelegram =
    hasActiveGatekeeperSearch &&
    (gatekeeperMatchedFaqs.length === 0 || overrideAfterReading);

  const handleGatekeeperInputChange = (value: string) => {
    setGatekeeperQuery(value);
    setGatekeeperEmptyWarning(false);
    setOverrideAfterReading(false);
    setIsVerifiedChecked(false);
    setGatekeeperSubmitted(value.trim().length > 0);
    setGatekeeperExpandedIds([]);
  };

  const handleGatekeeperCheckSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gatekeeperQuery.trim()) {
      setGatekeeperEmptyWarning(true);
      setGatekeeperSubmitted(false);
      return;
    }
    setGatekeeperEmptyWarning(false);
    setGatekeeperSubmitted(true);
  };

  const toggleGatekeeperMatchedItem = (id: number) => {
    setGatekeeperExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  return (
    <section
      aria-label="UoPeople Quick Guide and Frequently Asked Questions"
      className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 text-slate-100"
    >
      {/* Visual Step-by-Step Guide: UoPeople Library & Academic Research Guide */}
      <div className="rounded-2xl bg-slate-900/60 border border-indigo-500/35 shadow-xl backdrop-blur-md overflow-hidden">
        <button
          type="button"
          onClick={() => setIsLibraryGuideOpen((prev) => !prev)}
          aria-expanded={isLibraryGuideOpen}
          aria-controls="uopeople-library-guide-panel"
          className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 bg-gradient-to-r from-indigo-950/60 via-slate-900/80 to-slate-900/60 hover:from-indigo-950/80 transition-colors cursor-pointer"
        >
          <div className="space-y-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-indigo-300 text-[11px] font-bold tracking-wide">
              VISUAL STEP-BY-STEP TUTORIAL
            </span>
            <h2 className="text-base sm:text-xl font-extrabold text-slate-100 tracking-tight leading-snug">
              📚 UoPeople Library &amp; Academic Research Guide (သုတေသနစာတမ်းနှင့် အကိုးအကားရှာဖွေနည်း လမ်းညွှန်)
            </h2>
          </div>

          <span
            aria-hidden="true"
            className={`p-2 rounded-xl border transition-all duration-300 shrink-0 ${
              isLibraryGuideOpen
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-slate-950 text-slate-300 border-slate-700'
            }`}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-300 ${isLibraryGuideOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.25}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>

        <div
          id="uopeople-library-guide-panel"
          aria-hidden={!isLibraryGuideOpen}
          className={`grid transition-all duration-300 ease-in-out ${
            isLibraryGuideOpen ? 'grid-rows-[1fr] opacity-100 visible' : 'grid-rows-[0fr] opacity-0 invisible'
          }`}
        >
          <div className="overflow-hidden">
            <div className="p-5 sm:p-6 pt-4 border-t border-slate-800/80 space-y-6">
              {/* 7 Visual Walkthrough Cards */}
              <div className="space-y-4">
                {LIBRARY_GUIDE_STEPS.map((item) => {
                  const imgSrc = resolveStepImage(item);
                  const hasFailed = Boolean(failedImages[item.step]) || !imgSrc;

                  return (
                    <article
                      key={item.step}
                      className="rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/40 transition-colors p-4 sm:p-5 space-y-3"
                    >
                      <div className="flex items-start gap-3">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 font-bold text-xs shrink-0">
                          {item.label}
                        </span>
                        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                          {item.description}
                        </p>
                      </div>

                      {!hasFailed ? (
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxStep({
                              step: item.step,
                              label: item.label,
                              description: item.description,
                              src: imgSrc,
                            })
                          }
                          className="group relative block w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-zoom-in"
                          title="ပုံအကြီးချဲ့ကြည့်ရန် နှိပ်ပါ"
                        >
                          <img
                            src={imgSrc}
                            alt={`${item.label} ${item.description}`}
                            loading="lazy"
                            onError={() =>
                              setFailedImages((prev) => ({ ...prev, [item.step]: true }))
                            }
                            className="w-full max-h-[420px] object-contain mx-auto bg-slate-950 transition-transform duration-200 group-hover:scale-[1.01]"
                          />
                          <span className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-slate-950/85 border border-slate-700 text-[11px] font-semibold text-slate-200 opacity-90 group-hover:opacity-100">
                            🔍 ချဲ့ကြည့်ရန်
                          </span>
                        </button>
                      ) : (
                        <div className="w-full py-10 px-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 text-center space-y-1.5">
                          <div className="text-xs font-bold text-slate-300">
                            🖼️ {item.label} Screenshot Placeholder
                          </div>
                          <div className="text-[11px] text-slate-500">
                            ပုံဖိုင် ({imgSrc || `imgStep${item.step}`}) ထည့်သွင်းရန် နေရာ
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              {/* Verbatim Note Callout */}
              <div className="p-4 rounded-xl bg-amber-950/25 border border-amber-500/35 text-amber-200/95 text-xs sm:text-sm leading-relaxed flex items-start gap-3">
                <span aria-hidden="true" className="text-base shrink-0 mt-0.5">
                  💡
                </span>
                <p>
                  <strong className="font-bold text-amber-200">မှတ်ချက်:</strong> JSTOR, LIRN, Google Scholar အတွက်ရှာနည်းကို UoPeople Library မှာကြည့်နိုင်ပါတယ်။ အသေးစိတ်သူတို့ရှင်းပြထားပါတယ်။
                </p>
              </div>

              {/* Recommended Academic Search Engines & Direct Links */}
              <div className="space-y-3 pt-1">
                <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                  <span aria-hidden="true">🔎</span>
                  <span>Recommended Academic Search Engines &amp; Direct Links</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {RESEARCH_SEARCH_ENGINES.map((engine) => (
                    <a
                      key={engine.id}
                      href={engine.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 group ${
                        engine.recommended
                          ? 'sm:col-span-2 bg-indigo-950/45 border-indigo-500/50 hover:border-indigo-400 hover:bg-indigo-950/70 shadow-md shadow-indigo-950/25'
                          : 'bg-slate-950/75 border-slate-800 hover:border-slate-600 hover:bg-slate-900/90'
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono font-bold text-indigo-400">
                            {engine.id}.
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                            {engine.name}
                          </span>
                          {engine.badgeText && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-400/35 text-amber-300 text-[11px] font-bold">
                              {engine.badgeText}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">
                          {engine.url}
                        </div>
                      </div>

                      <span
                        aria-hidden="true"
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-white group-hover:border-slate-600 transition-colors shrink-0"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14 5l7 7m0 0l-7 7m7-7H3"
                          />
                        </svg>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Header & Search Controls for 40 FAQs */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl backdrop-blur-md space-y-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 shrink-0">
            <svg
              aria-hidden="true"
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-extrabold text-slate-100 tracking-tight">
              UoPeople Quick Guide &amp; FAQ (မေးလေ့ရှိသော မေးခွန်းများ)
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              University of the People ကျောင်းသားများအတွက် လိုအပ်သမျှ အချက်အလက်များနှင့် မေးလေ့ရှိသော မေးခွန်း {FAQ_DATA.length} စာရင်း
            </p>
          </div>
        </div>

        {/* Search Input & Expand/Collapse All */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <label htmlFor="faq-search-input" className="sr-only">
              Search FAQ questions and answers
            </label>
            <svg
              aria-hidden="true"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.35z"
              />
            </svg>
            <input
              id="faq-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="မေးခွန်းများ သို့မဟုတ် အဖြေများထဲတွင် ရှာဖွေရန်..."
              className="w-full pl-10 pr-16 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-300 hover:text-white px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={expandAll}
              disabled={isAllExpanded || filteredFaqs.length === 0}
              className="px-3.5 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 disabled:opacity-45 disabled:cursor-not-allowed border border-indigo-500/40 text-indigo-300 hover:text-indigo-200 text-xs font-bold transition-all cursor-pointer"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              disabled={openIds.length === 0}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 disabled:opacity-45 disabled:cursor-not-allowed border border-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              Collapse All
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            တွေ့ရှိသော မေးခွန်းအရေအတွက်:{' '}
            <strong className="text-slate-100">{filteredFaqs.length}</strong> / {FAQ_DATA.length}
          </span>
          {normalizedQuery && (
            <span className="text-indigo-400">ရှာဖွေမှု ရလဒ်များ ပြသနေသည်</span>
          )}
        </div>
      </div>

      {/* Accordion List */}
      {filteredFaqs.length === 0 ? (
        <div className="p-10 sm:p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <svg
            aria-hidden="true"
            className="w-10 h-10 text-slate-600 mx-auto"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-base font-bold text-slate-200">ရှာမတွေ့ပါ။</h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            သင်ရှာဖွေသော စာသားနှင့် ကိုက်ညီသော မေးခွန်း သို့မဟုတ် အဖြေ မရှိပါ။ အခြားသော သော့ချက်စာလုံးဖြင့် ထပ်မံ ရှာဖွေကြည့်ပါ။
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFaqs.map((item) => {
            const isOpen = openIds.includes(item.id);
            const buttonId = `faq-question-${item.id}`;
            const panelId = `faq-answer-${item.id}`;

            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition-colors duration-200 overflow-hidden ${
                  isOpen
                    ? 'bg-slate-900/90 border-indigo-500/50 shadow-lg shadow-indigo-950/30'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="w-full p-5 sm:p-6 text-left flex items-start justify-between gap-4 cursor-pointer select-none group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset rounded-2xl"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-mono text-xs font-extrabold shrink-0 mt-0.5">
                        #{item.id}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors leading-relaxed">
                        {item.question}
                      </span>
                    </div>
                    <span
                      aria-hidden="true"
                      className={`p-1.5 rounded-xl border transition-all duration-300 shrink-0 ${
                        isOpen
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 group-hover:border-slate-700'
                      }`}
                    >
                      <svg
                        className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.25}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>
                </h3>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  aria-hidden={!isOpen}
                  className={`grid transition-all duration-300 ease-in-out ${
                    isOpen ? 'grid-rows-[1fr] opacity-100 visible' : 'grid-rows-[0fr] opacity-0 invisible'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-5 sm:px-6 pb-5 pt-3 border-t border-slate-800/80 bg-slate-950/40">
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line font-normal">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Smart Deflection & Verification System (Helpdesk Gatekeeper) */}
      <div
        id="helpdesk-gatekeeper"
        className="rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-sky-950/35 border border-sky-500/40 shadow-2xl overflow-hidden"
      >
        {/* Banner Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 bg-gradient-to-r from-sky-950/60 via-slate-900/90 to-indigo-950/50 border-b border-slate-800 flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-400/35 text-sky-400 shrink-0">
              <svg
                aria-hidden="true"
                className="w-5 h-5 sm:w-6 sm:h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div className="space-y-0.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-400/30 text-sky-300 text-[10px] sm:text-[11px] font-bold tracking-wide uppercase">
                Helpdesk Gatekeeper &bull; Telegram Community Access
              </span>
              <h3 className="text-sm sm:text-lg font-extrabold text-slate-100 leading-snug">
                မေးခွန်းများမမေးမီ လမ်းညွှန်တွင် ရှာဖွေဖတ်ရှုပေးပါ
              </h3>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 ${
              isGatekeeperEligibleForTelegram && isVerifiedChecked
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                : 'bg-slate-950/80 border-slate-700 text-slate-400'
            }`}
          >
            {isGatekeeperEligibleForTelegram && isVerifiedChecked ? '🔓 Unlocked' : '🔒 Locked'}
          </span>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Step A: Input Query First */}
          <form onSubmit={handleGatekeeperCheckSubmit} className="space-y-2.5">
            <label
              htmlFor="gatekeeper-query-input"
              className="block text-xs sm:text-sm font-bold text-slate-200 leading-relaxed"
            >
              အဆင့် (၁) — သင်သိရှိလိုသောအကြောင်းအရာကို အရင် ရိုက်ထည့်ရှာဖွေပါ (ဥပမာ- WES, GPA, Scholarship, Proctor, Term)
            </label>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <svg
                  aria-hidden="true"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.35z"
                  />
                </svg>
                <input
                  id="gatekeeper-query-input"
                  type="text"
                  value={gatekeeperQuery}
                  onChange={(e) => handleGatekeeperInputChange(e.target.value)}
                  placeholder="သင်သိရှိလိုသောအကြောင်းအရာကို အရင် ရိုက်ထည့်ရှာဖွေပါ (ဥပမာ- WES, GPA, Scholarship, Proctor, Term)"
                  className="w-full pl-10 pr-16 py-3 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 transition-all"
                />
                {gatekeeperQuery && (
                  <button
                    type="button"
                    onClick={() => handleGatekeeperInputChange('')}
                    aria-label="Clear gatekeeper search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-300 hover:text-white px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-950/40 border border-indigo-400/40 transition-all cursor-pointer shrink-0"
              >
                စစ်ဆေးမည် (Check)
              </button>
            </div>

            {gatekeeperEmptyWarning && (
              <p className="text-xs text-amber-300 font-medium">
                ကျေးဇူးပြု၍ သင်သိရှိလိုသော အကြောင်းအရာ (သို့မဟုတ်) Keyword တစ်ခုခုကို အရင် ရိုက်ထည့်စစ်ဆေးပေးပါ။
              </p>
            )}
          </form>

          {/* Initial Unsearched State */}
          {!hasActiveGatekeeperSearch && (
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                မေးခွန်းအများစုကို အထက်ပါ <strong className="text-slate-200">FAQ ၄၀</strong> နှင့် <strong className="text-slate-200">UoPeople Library Guide</strong> တွင် အသေးစိတ် ဖြေကြားထားပြီး ဖြစ်ပါသည်။ Telegram Group လင့်ခ်ကို ဖွင့်ရန် သင်မေးလိုသည့်အကြောင်းအရာကို အရင် စစ်ဆေးပေးပါ။
              </p>
              <span className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 text-xs font-bold shrink-0 select-none">
                🔒 Telegram Community (စစ်ဆေးပြီးမှ ပွင့်ပါမည်)
              </span>
            </div>
          )}

          {/* Step B (Case 1): Keyword Matches Existing FAQ(s) */}
          {(hasActiveGatekeeperSearch || gatekeeperSubmitted) &&
            hasActiveGatekeeperSearch &&
            gatekeeperMatchedFaqs.length > 0 && (
              <div className="space-y-4">
                <div
                  role="alert"
                  className="p-4 sm:p-5 rounded-2xl bg-amber-950/35 border border-amber-500/50 space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs sm:text-sm font-bold text-amber-200 leading-relaxed">
                      ⚠️ သင်သိလိုသောအချက်ကို အထက်ပါ လမ်းညွှန်တွင် အပြည့်အစုံ ဖြေကြားထားပြီးဖြစ်ပါသည်။ ကျေးဇူးပြု၍ သေချာစွာ အရင်ဖတ်ရှုပေးပါ။
                    </p>
                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/35 text-amber-200 text-[11px] font-bold shrink-0">
                      တွေ့ရှိချက် {gatekeeperMatchedFaqs.length} ခု
                    </span>
                  </div>

                  {/* Directly render matched FAQ(s) inside the highlighted notification box */}
                  <div className="space-y-2.5">
                    {gatekeeperMatchedFaqs.map((faq, index) => {
                      const isExpanded =
                        gatekeeperMatchedFaqs.length <= 2 ||
                        index < 2 ||
                        gatekeeperExpandedIds.includes(faq.id);

                      return (
                        <div
                          key={faq.id}
                          className="rounded-xl bg-slate-950/85 border border-amber-500/30 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => toggleGatekeeperMatchedItem(faq.id)}
                            aria-expanded={isExpanded}
                            className="w-full p-4 sm:p-4 text-left flex items-start justify-between gap-3 hover:bg-slate-900/70 transition-colors cursor-pointer"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-400/30 text-amber-300 font-mono text-[11px] font-extrabold shrink-0 mt-0.5">
                                #{faq.id}
                              </span>
                              <span className="text-xs sm:text-sm font-bold text-slate-100 leading-relaxed">
                                {faq.question}
                              </span>
                            </div>
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-300 font-semibold shrink-0 mt-0.5">
                              <span>{isExpanded ? 'ပိတ်ရန်' : 'အဖြေဖတ်ရန်'}</span>
                              <svg
                                aria-hidden="true"
                                className={`w-3.5 h-3.5 transition-transform duration-300 ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.25}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="px-4 pb-4 pt-3 border-t border-slate-800/80 bg-slate-950/60">
                              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                                {faq.answer}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Keep Telegram locked by default; secondary confirmation for truly uncovered edge cases */}
                  {!overrideAfterReading ? (
                    <div className="pt-2 border-t border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <span className="text-xs text-amber-200/85 font-medium">
                        🔒 တူညီသောအဖြေ ရှိပြီးဖြစ်၍ Telegram Group လင့်ခ်ကို ခေတ္တပိတ်ထားပါသည်။
                      </span>
                      <button
                        type="button"
                        onClick={() => setOverrideAfterReading(true)}
                        className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-400/35 text-amber-200 text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
                      >
                        အထက်ပါအဖြေများ ဖတ်ပြီးသော်လည်း ကျွန်ုပ်မေးခွန်း မပါဝင်သေးပါ →
                      </button>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-amber-500/25 flex items-center justify-between gap-2 text-xs text-sky-300">
                      <span>✓ အထက်ပါအဖြေများကို စစ်ဆေးဖတ်ရှုပြီးကြောင်း မှတ်သားပြီးပါပြီ။ အောက်ပါ အတည်ပြုချက်ကို ဖြည့်စွက်ပါ။</span>
                      <button
                        type="button"
                        onClick={() => {
                          setOverrideAfterReading(false);
                          setIsVerifiedChecked(false);
                        }}
                        className="text-slate-400 hover:text-slate-200 underline shrink-0 cursor-pointer"
                      >
                        ပယ်ဖျက်မည်
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Step B (Case 2): No matching FAQ found OR secondary confirmation opened -> Step C Explicit Agreement */}
          {isGatekeeperEligibleForTelegram && (
            <div className="p-4 sm:p-5 rounded-2xl bg-sky-950/30 border border-sky-500/40 space-y-4">
              <div className="flex items-start gap-2.5">
                <span aria-hidden="true" className="text-base shrink-0 mt-0.5">
                  💬
                </span>
                <p className="text-xs sm:text-sm font-bold text-sky-200 leading-relaxed">
                  လမ်းညွှန်တွင် မပါဝင်သေးသော မေးခွန်းဖြစ်ပါက အောက်ပါ Telegram Group တွင် ဝင်ရောက်မေးမြန်းနိုင်ပါသည်။
                </p>
              </div>

              {/* Step C: Explicit Agreement Checkbox */}
              <label
                htmlFor="gatekeeper-agreement-checkbox"
                className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-sky-500/40 transition-colors cursor-pointer select-none"
              >
                <input
                  id="gatekeeper-agreement-checkbox"
                  type="checkbox"
                  checked={isVerifiedChecked}
                  onChange={(e) => setIsVerifiedChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-950 cursor-pointer shrink-0"
                />
                <span className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                  UoPeople Quick Guide ထဲတွင် ရှာဖွေဖတ်ရှုပြီးဖြစ်သော်လည်း မပါဝင်သေးသည့် အကြောင်းအရာဖြစ်ကြောင်း အတည်ပြုပါသည်။
                </span>
              </label>

              {/* Telegram Action Button (Only clickable when checkbox is checked) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">
                  {isVerifiedChecked
                    ? '✓ အတည်ပြုပြီးပါပြီ — အောက်ပါခလုတ်ကို နှိပ်၍ ဝင်ရောက်မေးမြန်းနိုင်ပါသည်။'
                    : 'အတည်ပြုချက် Checkbox ကို အမှန်ခြစ်မှသာ Telegram ခလုတ် အလုပ်လုပ်ပါမည်။'}
                </span>

                {isVerifiedChecked ? (
                  <a
                    href="https://t.me/+nvBtH_Du5685NzQ1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-sky-900/40 border border-sky-400/50 transition-all inline-flex items-center justify-center gap-2 shrink-0"
                  >
                    <svg
                      aria-hidden="true"
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.62 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.75 3.99-1.74 6.65-2.89 7.99-3.44 3.81-1.58 4.6-1.86 5.12-1.87.11 0 .37.03.54.17.14.11.18.26.2.37.01.07.03.29.01.44z" />
                    </svg>
                    <span>Telegram Community တွင် မေးမြန်းရန်</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="px-5 py-2.5 rounded-xl bg-slate-800/80 text-slate-400 text-xs sm:text-sm font-bold border border-slate-700 opacity-60 cursor-not-allowed inline-flex items-center justify-center gap-2 shrink-0"
                  >
                    <svg
                      aria-hidden="true"
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <span>Telegram Community တွင် မေးမြန်းရန်</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click-to-Zoom Lightbox Preview Modal */}
      {lightboxStep && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${lightboxStep.label} Preview`}
          onClick={() => setLightboxStep(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm p-4 sm:p-8 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-5xl w-full rounded-2xl bg-slate-950 border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-900">
              <div className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                <span className="text-indigo-400 mr-2">{lightboxStep.label}</span>
                <span>{lightboxStep.description}</span>
              </div>
              <button
                type="button"
                onClick={() => setLightboxStep(null)}
                aria-label="Close image preview"
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer shrink-0"
              >
                ✕ ပိတ်မည်
              </button>
            </div>
            <div className="p-3 sm:p-4 overflow-auto flex-1 flex items-center justify-center bg-black">
              <img
                src={lightboxStep.src}
                alt={`${lightboxStep.label} ${lightboxStep.description}`}
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default QuickGuideFAQ;
